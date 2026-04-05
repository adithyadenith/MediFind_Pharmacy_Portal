import { useGetDashboardStats, useGetRecentOrders, useGetLowStockMedicines } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, ShoppingCart, Package, AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: recentOrders, isLoading: ordersLoading } = useGetRecentOrders();
  const { data: lowStock, isLoading: lowStockLoading } = useGetLowStockMedicines();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
        <p className="text-muted-foreground">Welcome back. Here's what's happening today.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total Revenue" 
          value={stats ? `$${stats.totalRevenue.toFixed(2)}` : null} 
          icon={DollarSign} 
          isLoading={statsLoading} 
        />
        <StatCard 
          title="Pending Orders" 
          value={stats?.pendingOrders.toString() || null} 
          icon={Clock} 
          isLoading={statsLoading} 
          alert={stats?.pendingOrders ? stats.pendingOrders > 0 : false}
        />
        <StatCard 
          title="Completed Orders" 
          value={stats?.completedOrders.toString() || null} 
          icon={CheckCircle} 
          isLoading={statsLoading} 
        />
        <StatCard 
          title="Low Stock Items" 
          value={stats?.lowStockCount.toString() || null} 
          icon={AlertTriangle} 
          isLoading={statsLoading} 
          alert={stats?.lowStockCount ? stats.lowStockCount > 0 : false}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-card/40 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Recent Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full bg-border/20" />)}
              </div>
            ) : recentOrders && recentOrders.length > 0 ? (
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border/50">
                    <div>
                      <p className="font-medium">{order.patientName}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(order.createdAt), "MMM d, yyyy 'at' h:mm a")}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-semibold">${order.totalPrice.toFixed(2)}</span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">No recent orders</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/40 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full bg-border/20" />)}
              </div>
            ) : lowStock && lowStock.length > 0 ? (
              <div className="space-y-4">
                {lowStock.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border/50">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.category}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${item.quantity === 0 ? 'text-destructive' : 'text-amber-500'}`}>
                        {item.quantity} left
                      </p>
                      <Badge variant={item.quantity === 0 ? "destructive" : "outline"} className={item.quantity > 0 ? "border-amber-500/50 text-amber-500" : ""}>
                        {item.status.replace("_", " ").toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">Inventory levels look good</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, isLoading, alert = false }: any) {
  return (
    <Card className={`bg-card/40 backdrop-blur-sm border-border/50 ${alert ? 'border-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.1)]' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${alert ? 'text-primary' : 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24 bg-border/20" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'pending':
      return <Badge variant="outline" className="border-amber-500/50 text-amber-500 bg-amber-500/10">PENDING</Badge>;
    case 'accepted':
      return <Badge variant="outline" className="border-emerald-500/50 text-emerald-500 bg-emerald-500/10">ACCEPTED</Badge>;
    case 'rejected':
      return <Badge variant="destructive">REJECTED</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
