import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Edit2, Trash2, Search, PackageOpen, Package, AlertTriangle, XCircle, TrendingUp, Filter, X } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useListMedicines, useCreateMedicine, useUpdateMedicine, useDeleteMedicine, getListMedicinesQueryKey, getGetDashboardStatsQueryKey, getGetLowStockMedicinesQueryKey } from "@/lib/api-client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Medicine {
  id: number;
  name: string;
  category: string;
  quantity: number;
  price: number;
  expiryDate: string;
  status: "available" | "low" | "out_of_stock";
}

const medicineSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  category: z.string().min(2, "Category is required"),
  quantity: z.coerce.number().min(0, "Quantity must be 0 or more"),
  price: z.coerce.number().min(0, "Price must be 0 or more"),
  expiryDate: z.string().min(1, "Expiry date is required"),
});
type FormValues = z.infer<typeof medicineSchema>;

const CATEGORIES = ["Analgesics", "Antibiotics", "Antidiabetic", "Antiviral", "Cardiovascular", "Dermatology", "Gastrointestinal", "Respiratory", "Vitamins & Supplements", "Other"];

export default function Inventory() {
  const queryClient = useQueryClient();
  const { data: apiMedicines, isLoading } = useListMedicines();
  const createMutation = useCreateMedicine();
  const updateMutation = useUpdateMedicine();
  const deleteMutation = useDeleteMedicine();

  const medicines: Medicine[] = (apiMedicines as Medicine[] | undefined) ?? [];

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [deletingMedicine, setDeletingMedicine] = useState<Medicine | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(medicineSchema),
    defaultValues: { name: "", category: "", quantity: 0, price: 0, expiryDate: new Date().toISOString().split("T")[0] },
  });

  const totalItems = medicines.length;
  const inStock = medicines.filter((m) => m.status === "available").length;
  const lowStock = medicines.filter((m) => m.status === "low").length;
  const outOfStock = medicines.filter((m) => m.status === "out_of_stock").length;
  const totalValue = medicines.reduce((sum, m) => sum + m.price * m.quantity, 0);

  const filteredMedicines = medicines.filter((m) => {
    const matchSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = categoryFilter === "all" || m.category === categoryFilter;
    const matchStatus = statusFilter === "all" || m.status === statusFilter;
    return matchSearch && matchCategory && matchStatus;
  });

  const uniqueCategories = [...new Set(medicines.map((m) => m.category))].sort();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: getListMedicinesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetLowStockMedicinesQueryKey() });
  };

  const onSubmit = async (values: FormValues) => {
    try {
      if (editingMedicine) {
        await updateMutation.mutateAsync({ id: editingMedicine.id, data: values });
        toast.success("Medicine updated successfully");
      } else {
        await createMutation.mutateAsync({ data: values });
        toast.success("Medicine added successfully");
      }
      setIsAddOpen(false);
      setEditingMedicine(null);
      form.reset();
      invalidateQueries();
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    }
  };

  const handleDelete = async () => {
    if (!deletingMedicine) return;

    try {
      await deleteMutation.mutateAsync({ id: deletingMedicine.id });
      toast.success("Medicine deleted successfully");
      setDeletingMedicine(null);
      invalidateQueries();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete medicine");
    }
  };

  const openEdit = (medicine: Medicine) => {
    setEditingMedicine(medicine);
    form.reset({
      name: medicine.name,
      category: medicine.category,
      quantity: medicine.quantity,
      price: medicine.price,
      expiryDate: new Date(medicine.expiryDate).toISOString().split("T")[0],
    });
    setIsAddOpen(true);
  };

  const openAdd = () => {
    setEditingMedicine(null);
    form.reset({ name: "", category: "", quantity: 0, price: 0, expiryDate: new Date().toISOString().split("T")[0] });
    setIsAddOpen(true);
  };

  const hasFilters = searchTerm || categoryFilter !== "all" || statusFilter !== "all";
  const clearFilters = () => { setSearchTerm(""); setCategoryFilter("all"); setStatusFilter("all"); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground mt-1">Manage your pharmacy stock and medicine tracking.</p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Medicine
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Package} label="Total Items" value={totalItems} color="text-primary" bg="bg-primary/10" />
        <StatCard icon={TrendingUp} label="In Stock" value={inStock} color="text-emerald-500" bg="bg-emerald-500/10" />
        <StatCard icon={AlertTriangle} label="Low Stock" value={lowStock} color="text-amber-500" bg="bg-amber-500/10" />
        <StatCard icon={XCircle} label="Out of Stock" value={outOfStock} color="text-destructive" bg="bg-destructive/10" />
      </div>

      <div className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm px-6 py-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Total Inventory Value</span>
        <span className="text-xl font-bold text-primary">${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>

      <Card className="bg-card/40 backdrop-blur-sm border-border/50">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search medicines..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background/50"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px] bg-background/50">
                <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {uniqueCategories.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] bg-background/50">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="low">Low Stock</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock</SelectItem>
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}

            <span className="ml-auto text-sm text-muted-foreground">
              {filteredMedicines.length} of {totalItems} items
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/40 backdrop-blur-sm border-border/50">
        <div className="rounded-md overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="pl-6">Medicine Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(7)].map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredMedicines.length > 0 ? (
                filteredMedicines.map((medicine) => (
                  <TableRow key={medicine.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="pl-6 font-medium">{medicine.name}</TableCell>
                    <TableCell>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary font-medium">
                        {medicine.category}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">${medicine.price.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      <span className={medicine.quantity === 0 ? "text-destructive" : medicine.quantity <= 15 ? "text-amber-500" : ""}>
                        {medicine.quantity}
                      </span>
                    </TableCell>
                    <TableCell><StatusBadge status={medicine.status} /></TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(medicine.expiryDate), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                          onClick={() => openEdit(medicine)}
                          title="Edit"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeletingMedicine(medicine)}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <PackageOpen className="h-10 w-10 opacity-40" />
                      <p className="font-medium">No medicines found</p>
                      {hasFilters && (
                        <Button variant="link" size="sm" onClick={clearFilters}>
                          Clear filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) setEditingMedicine(null); }}>
        <DialogContent className="sm:max-w-[480px] bg-card/95 backdrop-blur-xl border-border">
          <DialogHeader>
            <DialogTitle>{editingMedicine ? "Edit Medicine" : "Add New Medicine"}</DialogTitle>
            <DialogDescription>
              {editingMedicine
                ? `Update the details for "${editingMedicine.name}".`
                : "Fill in the medicine details to add it to your inventory."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Medicine Name</FormLabel>
                  <FormControl><Input placeholder="e.g. Paracetamol 500mg" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CATEGORIES.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="quantity" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity (units)</FormLabel>
                    <FormControl><Input type="number" min={0} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Price ($)</FormLabel>
                    <FormControl><Input type="number" min={0} step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="expiryDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Expiry Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingMedicine ? "Update Medicine" : "Add Medicine"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingMedicine} onOpenChange={(open) => !open && setDeletingMedicine(null)}>
        <AlertDialogContent className="bg-card/95 backdrop-blur-xl border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete medicine?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <span className="font-semibold text-foreground">{deletingMedicine?.name}</span>{" "}
              from your inventory. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Yes, delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, color, bg,
}: { icon: React.ElementType; label: string; value: number; color: string; bg: string }) {
  return (
    <Card className="bg-card/40 backdrop-blur-sm border-border/50">
      <CardContent className="p-4 flex items-center gap-4">
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

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "available":
      return <Badge variant="outline" className="border-emerald-500/40 text-emerald-500 bg-emerald-500/10 text-[11px]">In Stock</Badge>;
    case "low":
      return <Badge variant="outline" className="border-amber-500/40 text-amber-500 bg-amber-500/10 text-[11px]">Low Stock</Badge>;
    case "out_of_stock":
      return <Badge variant="destructive" className="text-[11px]">Out of Stock</Badge>;
    default:
      return <Badge variant="outline" className="text-[11px]">{status}</Badge>;
  }
}
