import { useState, useEffect, useCallback, useRef } from "react";
import { format } from "date-fns";
import {
  Bell, CheckCircle2, XCircle, ShoppingBag, X, User, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useListOrders, useAcceptOrder, useRejectOrder, getListOrdersQueryKey, getGetDashboardStatsQueryKey, getGetRecentOrdersQueryKey, getGetLowStockMedicinesQueryKey, getListMedicinesQueryKey } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type OrderStatus = "pending" | "accepted" | "ready" | "completed" | "rejected" | "cancelled";

interface OrderItem {
  id: number;
  medicineName: string;
  quantity: number;
  price: number;
}

interface Order {
  id: number;
  patientName: string;
  patientEmail: string;
  createdAt: string;
  totalPrice: number;
  status: OrderStatus;
  items: OrderItem[];
}

const SEEN_KEY = "medifind_seen_order_ids";
const POLL_MS = 4000;

function readSeenIds(): Set<number> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveSeenIds(ids: Set<number>) {
  localStorage.setItem(SEEN_KEY, JSON.stringify([...ids]));
}

function markSeen(id: number) {
  const seen = readSeenIds();
  seen.add(id);
  saveSeenIds(seen);
}

async function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() }),
    queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() }),
    queryClient.invalidateQueries({ queryKey: getGetRecentOrdersQueryKey() }),
    queryClient.invalidateQueries({ queryKey: getGetLowStockMedicinesQueryKey() }),
    queryClient.invalidateQueries({ queryKey: getListMedicinesQueryKey() }),
  ]);
}

export function OrderNotification() {
  const [queue, setQueue] = useState<Order[]>([]);
  const [visible, setVisible] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { data } = useListOrders(undefined, {
    query: {
      queryKey: getListOrdersQueryKey(),
      refetchInterval: POLL_MS,
    },
  });
  const acceptMutation = useAcceptOrder();
  const rejectMutation = useRejectOrder();
  const orders = (data as Order[] | undefined) ?? [];

  const checkForNewOrders = useCallback(() => {
    const seen = readSeenIds();
    const fresh = orders.filter((order) => order.status === "pending" && !seen.has(order.id));

    if (!fresh.length) return;

    fresh.forEach((order) => markSeen(order.id));
    setQueue((prev) => {
      const existingIds = new Set(prev.map((order) => order.id));
      return [...prev, ...fresh.filter((order) => !existingIds.has(order.id))];
    });
    setVisible(true);
  }, [orders]);

  useEffect(() => {
    const seen = readSeenIds();
    if (seen.size === 0 && orders.length > 0) {
      saveSeenIds(new Set(orders.filter((order) => order.status === "pending").map((order) => order.id)));
      return;
    }

    checkForNewOrders();
  }, [orders, checkForNewOrders]);

  useEffect(() => {
    if (visible && bellRef.current) {
      bellRef.current.classList.add("bell-ring");
      const t = setTimeout(() => bellRef.current?.classList.remove("bell-ring"), 700);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [visible, queue.length]);

  const currentOrder = queue[0] ?? null;

  const dismiss = useCallback(() => {
    setDismissing(true);
    setTimeout(() => {
      setQueue((prev) => prev.slice(1));
      setDismissing(false);
      setVisible((prevVisible) => queue.length > 1 ? prevVisible : false);
    }, 280);
  }, [queue.length]);

  const handleAction = async (action: "accept" | "reject") => {
    if (!currentOrder) return;

    try {
      if (action === "accept") {
        await acceptMutation.mutateAsync({ id: currentOrder.id });
        toast.success(`Order #${currentOrder.id} accepted`);
      } else {
        await rejectMutation.mutateAsync({ id: currentOrder.id });
        toast.success(`Order #${currentOrder.id} rejected`);
      }

      await invalidateAll(queryClient);
      dismiss();
    } catch (error: any) {
      toast.error(error.message || "Failed to update order");
    }
  };

  if (!visible || !currentOrder) return null;

  const remainingCount = queue.length - 1;

  return (
    <>
      <div
        className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm"
        style={{
          animation: dismissing
            ? "fadeOut 0.28s ease forwards"
            : "fadeIn 0.22s ease forwards",
        }}
        onClick={dismiss}
      />

      <div className="fixed z-[9999] inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-md"
          style={{
            animation: dismissing
              ? "slideDown 0.28s ease forwards"
              : "slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards",
          }}
        >
          <div className="relative rounded-2xl border border-amber-500/40 bg-card/95 backdrop-blur-xl shadow-[0_0_60px_-12px_rgba(245,158,11,0.4)] overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div ref={bellRef} className="relative">
                  <div className="h-10 w-10 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                    <Bell className="h-5 w-5 text-amber-400" />
                  </div>
                  <span className="absolute inset-0 rounded-full animate-ping bg-amber-500/20" />
                </div>
                <div>
                  <p className="font-bold text-foreground text-base leading-tight">
                    New Order Received!
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Requires your attention
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {remainingCount > 0 && (
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[11px]">
                    +{remainingCount} more
                  </Badge>
                )}
                <button
                  onClick={dismiss}
                  className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">
                      {currentOrder.patientName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {currentOrder.patientEmail}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground font-mono">
                    #{currentOrder.id.toString().padStart(6, "0")}
                  </p>
                  <p className="text-xl font-bold text-primary">
                    ${currentOrder.totalPrice.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {format(new Date(currentOrder.createdAt), "MMM d, yyyy 'at' h:mm a")}
              </div>

              <div className="rounded-xl bg-background/60 border border-border/50 p-3">
                <h4 className="text-xs font-medium text-muted-foreground mb-2.5 flex items-center gap-1.5">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  Order Items ({currentOrder.items.length})
                </h4>
                <div className="space-y-1.5">
                  {currentOrder.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        <span className="text-foreground font-medium">
                          {item.quantity}x
                        </span>{" "}
                        {item.medicineName}
                      </span>
                      <span className="font-mono text-muted-foreground text-xs self-center">
                        ${item.price.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-5 pb-5 grid grid-cols-2 gap-3">
              <Button
                onClick={() => handleAction("reject")}
                variant="outline"
                className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive/60 gap-2 h-11 rounded-xl"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
              <Button
                onClick={() => handleAction("accept")}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white gap-2 h-11 rounded-xl shadow-lg shadow-emerald-900/30"
              >
                <CheckCircle2 className="h-4 w-4" />
                Accept Order
              </Button>
            </div>

            <div className="absolute bottom-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
          </div>
        </div>
      </div>
    </>
  );
}
