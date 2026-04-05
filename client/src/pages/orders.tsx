import * as React from "react";
import { format } from "date-fns";
import {
  CheckCircle2, XCircle, Clock, ShoppingBag, PackageCheck,
  HandCoins, Ban, Inbox, LayoutList, History,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListOrders,
  useAcceptOrder,
  useRejectOrder,
  getListOrdersQueryKey,
  getGetDashboardStatsQueryKey,
  getGetRecentOrdersQueryKey,
  getGetLowStockMedicinesQueryKey,
  getListMedicinesQueryKey,
} from "@/lib/api-client";

import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  updatedAt: string;
  totalPrice: number;
  status: OrderStatus;
  items: OrderItem[];
}

const POLL_MS = 4000;

async function postOrderTransition(id: number, action: "ready" | "complete" | "cancel") {
  const response = await fetch(`/api/orders/${id}/${action}`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || `Failed to ${action} order`);
  }

  return response.json() as Promise<Order>;
}

export default function Orders() {
  const [tab, setTab] = React.useState("pending");
  const queryClient = useQueryClient();
  const { data, isLoading } = useListOrders(undefined, {
    query: {
      queryKey: getListOrdersQueryKey(),
      refetchInterval: POLL_MS,
    },
  });
  const acceptMutation = useAcceptOrder();
  const rejectMutation = useRejectOrder();

  const orders = (data as Order[] | undefined) ?? [];

  const invalidateQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetRecentOrdersQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetLowStockMedicinesQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListMedicinesQueryKey() }),
    ]);
  };

  const transition = async (id: number, to: OrderStatus, label: string) => {
    try {
      if (to === "accepted") {
        await acceptMutation.mutateAsync({ id });
      } else if (to === "rejected") {
        await rejectMutation.mutateAsync({ id });
      } else if (to === "ready") {
        await postOrderTransition(id, "ready");
      } else if (to === "completed") {
        await postOrderTransition(id, "complete");
      } else if (to === "cancelled") {
        await postOrderTransition(id, "cancel");
      }

      await invalidateQueries();
      toast.success(label);
    } catch (error: any) {
      toast.error(error.message || "Failed to update order");
    }
  };

  const pending = orders.filter((o) => o.status === "pending");
  const active = orders.filter((o) => o.status === "accepted" || o.status === "ready");
  const completed = orders.filter((o) => o.status === "completed" || o.status === "rejected" || o.status === "cancelled");

  const tabCount = (n: number) => n > 0
    ? <span className="ml-1.5 rounded-full bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 font-medium">{n}</span>
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground mt-1">Manage customer orders through the fulfilment pipeline.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Pending" value={pending.length} color="text-amber-500" bg="bg-amber-500/10" icon={Clock} />
        <SummaryCard label="In Progress" value={active.length} color="text-blue-500" bg="bg-blue-500/10" icon={PackageCheck} />
        <SummaryCard label="Completed" value={orders.filter((o) => o.status === "completed").length} color="text-emerald-500" bg="bg-emerald-500/10" icon={CheckCircle2} />
        <SummaryCard label="Rejected / Cancelled" value={orders.filter((o) => o.status === "rejected" || o.status === "cancelled").length} color="text-destructive" bg="bg-destructive/10" icon={Ban} />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="bg-background/50 border border-white/10">
          <TabsTrigger value="pending" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <Inbox className="h-3.5 w-3.5 mr-1.5" />
            Pending {tabCount(pending.length)}
          </TabsTrigger>
          <TabsTrigger value="active" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <LayoutList className="h-3.5 w-3.5 mr-1.5" />
            Active {tabCount(active.length)}
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <History className="h-3.5 w-3.5 mr-1.5" />
            History {tabCount(completed.length)}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {isLoading ? (
            <EmptyState icon={Clock} title="Loading orders" message="Fetching pending orders from the database." />
          ) : pending.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="All caught up!" message="No pending orders right now." />
          ) : (
            pending.map((order) => (
              <OrderCard key={order.id} order={order}>
                <div className="flex flex-col gap-2 min-w-[180px]">
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                    onClick={() => transition(order.id, "accepted", `Order #${order.id} accepted`)}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Accept Order
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 gap-2"
                    onClick={() => transition(order.id, "rejected", `Order #${order.id} rejected`)}
                  >
                    <XCircle className="h-4 w-4" /> Reject Order
                  </Button>
                </div>
              </OrderCard>
            ))
          )}
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          {isLoading ? (
            <EmptyState icon={PackageCheck} title="Loading orders" message="Fetching active orders from the database." />
          ) : active.length === 0 ? (
            <EmptyState icon={PackageCheck} title="Nothing in progress" message="Accepted orders will appear here." />
          ) : (
            active.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                accentColor={order.status === "ready" ? "border-l-blue-500" : "border-l-emerald-500"}
              >
                {order.status === "accepted" ? (
                  <div className="flex flex-col gap-2 min-w-[180px]">
                    <Button
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
                      onClick={() => transition(order.id, "ready", `Order #${order.id} marked as ready`)}
                    >
                      <PackageCheck className="h-4 w-4" /> Mark as Ready
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full border-destructive/50 text-destructive hover:bg-destructive/10 gap-2"
                      onClick={() => transition(order.id, "cancelled", `Order #${order.id} cancelled`)}
                    >
                      <Ban className="h-4 w-4" /> Cancel Order
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 min-w-[180px]">
                    <div className="text-center mb-1">
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                        Ready for pickup
                      </span>
                    </div>
                    <Button
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                      onClick={() => transition(order.id, "completed", `Order #${order.id} completed`)}
                    >
                      <HandCoins className="h-4 w-4" /> Hand Over
                    </Button>
                  </div>
                )}
              </OrderCard>
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {isLoading ? (
            <EmptyState icon={History} title="Loading history" message="Fetching completed and rejected orders from the database." />
          ) : completed.length === 0 ? (
            <EmptyState icon={History} title="No history yet" message="Completed and rejected orders will appear here." />
          ) : (
            completed.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                accentColor={order.status === "completed" ? "border-l-emerald-500" : "border-l-muted-foreground"}
                dimmed
              >
                <div className="flex flex-col items-center justify-center gap-2 min-w-[140px] text-center">
                  {order.status === "completed" && (
                    <>
                      <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                      <span className="text-xs font-medium text-emerald-500">Completed</span>
                    </>
                  )}
                  {order.status === "rejected" && (
                    <>
                      <XCircle className="h-8 w-8 text-destructive" />
                      <span className="text-xs font-medium text-destructive">Rejected</span>
                    </>
                  )}
                  {order.status === "cancelled" && (
                    <>
                      <Ban className="h-8 w-8 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Cancelled</span>
                    </>
                  )}
                </div>
              </OrderCard>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OrderCard({
  order,
  children,
  accentColor = "border-l-amber-500",
  dimmed = false,
}: {
  order: Order;
  children: React.ReactNode;
  accentColor?: string;
  dimmed?: boolean;
}) {
  return (
    <Card className={`bg-card/40 backdrop-blur-sm border-border/50 border-l-4 ${accentColor} overflow-hidden ${dimmed ? "opacity-75" : ""}`}>
      <div className="flex flex-col md:flex-row">
        <div className="flex-1 p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold">{order.patientName}</h3>
                <StatusBadge status={order.status} />
              </div>
              <p className="text-sm text-muted-foreground">{order.patientEmail}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(order.createdAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Order ID</p>
              <p className="font-mono font-medium text-sm">#{order.id.toString().padStart(6, "0")}</p>
              <p className="text-2xl font-bold text-primary mt-1">${order.totalPrice.toFixed(2)}</p>
            </div>
          </div>

          <div className="bg-background/50 rounded-lg p-3 border border-border/50">
            <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <ShoppingBag className="h-3.5 w-3.5" /> Order Items
            </h4>
            <div className="space-y-1.5">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    <span className="text-foreground font-medium">{item.quantity}x</span> {item.medicineName}
                  </span>
                  <span className="font-mono text-muted-foreground">${item.price.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-muted/20 p-5 flex md:flex-col justify-end items-center gap-3 border-t md:border-t-0 md:border-l border-border/50">
          {children}
        </div>
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, { label: string; className: string }> = {
    pending: { label: "Pending", className: "border-amber-500/50 text-amber-500 bg-amber-500/10" },
    accepted: { label: "Accepted", className: "border-emerald-500/50 text-emerald-500 bg-emerald-500/10" },
    ready: { label: "Ready", className: "border-blue-500/50 text-blue-400 bg-blue-500/10" },
    completed: { label: "Completed", className: "border-emerald-500/50 text-emerald-500 bg-emerald-500/10" },
    rejected: { label: "Rejected", className: "border-destructive/50 text-destructive bg-destructive/10" },
    cancelled: { label: "Cancelled", className: "border-muted-foreground/50 text-muted-foreground bg-muted/20" },
  };
  const { label, className } = map[status];
  return <Badge variant="outline" className={`text-[11px] ${className}`}>{label}</Badge>;
}

function SummaryCard({
  label, value, color, bg, icon: Icon,
}: { label: string; value: number; color: string; bg: string; icon: React.ElementType }) {
  return (
    <Card className="bg-card/40 backdrop-blur-sm border-border/50">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon: Icon, title, message }: { icon: React.ElementType; title: string; message: string }) {
  return (
    <Card className="bg-card/40 border-dashed border-2">
      <CardContent className="flex flex-col items-center justify-center h-52 text-center gap-3">
        <Icon className="h-12 w-12 text-primary/30" />
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardContent>
    </Card>
  );
}
