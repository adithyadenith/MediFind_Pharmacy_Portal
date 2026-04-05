import { getListOrdersQueryKey, useListOrders } from "@/lib/api-client";
import { format } from "date-fns";
import { CheckCircle2, XCircle, ShoppingBag, Calendar, PackageOpen } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  status: OrderStatus;
  totalPrice: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

const POLL_MS = 4000;

export default function History() {
  const { data, isLoading } = useListOrders(undefined, {
    query: {
      queryKey: getListOrdersQueryKey(),
      refetchInterval: POLL_MS,
    },
  });

  const orders = (data as Order[] | undefined) ?? [];
  const completedOrders = orders.filter((order) => order.status === "completed");
  const rejectedOrders = orders.filter((order) => order.status === "rejected" || order.status === "cancelled");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Order History</h1>
        <p className="text-muted-foreground">View past completed and rejected orders.</p>
      </div>

      <Tabs defaultValue="completed" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-background/50 border border-border/50">
          <TabsTrigger value="completed" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Completed
          </TabsTrigger>
          <TabsTrigger value="rejected" className="data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground">
            Rejected
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="completed" className="mt-6">
          <OrderList orders={completedOrders} isLoading={isLoading} status="completed" />
        </TabsContent>
        
        <TabsContent value="rejected" className="mt-6">
          <OrderList orders={rejectedOrders} isLoading={isLoading} status="rejected" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OrderList({ orders, isLoading, status }: { orders?: Order[], isLoading: boolean, status: string }) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full bg-card/40 border border-border/50" />)}
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <Card className="bg-card/40 border-dashed border-2">
        <CardContent className="flex flex-col items-center justify-center h-64 text-center">
          <PackageOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <CardTitle>No orders found</CardTitle>
          <CardDescription className="mt-2">No {status} orders in your history.</CardDescription>
        </CardContent>
      </Card>
    );
  }

  const isAccepted = status === "completed";
  const borderColorClass = isAccepted ? 'border-l-emerald-500' : 'border-l-destructive';

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <Card key={order.id} className={`bg-card/40 backdrop-blur-sm border-border/50 border-l-4 ${borderColorClass}`}>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold">{order.patientName}</h3>
                  {isAccepted ? (
                    <Badge variant="outline" className="border-emerald-500/50 text-emerald-500 bg-emerald-500/10">
                      COMPLETED
                    </Badge>
                  ) : (
                    <Badge variant="destructive">REJECTED</Badge>
                  )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-muted-foreground mt-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>Created: {format(new Date(order.createdAt), "MMM d, yyyy h:mm a")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAccepted ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-destructive" />}
                    <span>{isAccepted ? "Completed" : "Rejected"}: {format(new Date(order.updatedAt), "MMM d, yyyy h:mm a")}</span>
                  </div>
                </div>
              </div>
              
              <div className="md:w-72 bg-background/50 rounded-lg p-4 border border-border/50">
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-border/50">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4" /> Order Total
                  </h4>
                  <span className="font-bold text-primary">${order.totalPrice.toFixed(2)}</span>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground max-h-24 overflow-y-auto pr-2">
                  {order.items.map(item => (
                    <div key={item.id} className="flex justify-between">
                      <span className="truncate pr-2">{item.quantity}x {item.medicineName}</span>
                      <span>${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
