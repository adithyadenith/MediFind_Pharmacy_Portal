import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, Bell, Shield, Store } from "lucide-react";
import { toast } from "sonner";
import { useGetMe } from "@/lib/api-client";

export default function Settings() {
  const { data: user } = useGetMe();
  const [profile, setProfile] = useState({
    pharmacyName: "",
    email: "",
    address: "",
    contactNumber: "",
  });

  useEffect(() => {
    if (!user) {
      return;
    }

    setProfile({
      pharmacyName: user.pharmacyName ?? "",
      email: user.email ?? "",
      address: user.address ?? "",
      contactNumber: user.contactNumber ?? "",
    });
  }, [user]);

  const handleSave = () => {
    toast.success("Settings saved successfully");
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your pharmacy portal preferences.</p>
      </div>

      <div className="grid gap-6">
        <Card className="bg-card/40 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="w-5 h-5 text-primary" /> Pharmacy Profile
            </CardTitle>
            <CardDescription>Update your business information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Pharmacy Name</Label>
                <Input
                  id="name"
                  value={profile.pharmacyName}
                  onChange={(event) => setProfile((current) => ({ ...current, pharmacyName: event.target.value }))}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Contact Email</Label>
                <Input
                  id="email"
                  value={profile.email}
                  onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactNumber">Contact Number</Label>
                <Input
                  id="contactNumber"
                  value={profile.contactNumber}
                  onChange={(event) => setProfile((current) => ({ ...current, contactNumber: event.target.value }))}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={profile.address}
                  onChange={(event) => setProfile((current) => ({ ...current, address: event.target.value }))}
                  className="bg-background/50"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" /> Notifications
            </CardTitle>
            <CardDescription>Configure how you receive alerts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">New Order Alerts</Label>
                <p className="text-sm text-muted-foreground">Receive a notification when a new order arrives.</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Low Stock Warnings</Label>
                <p className="text-sm text-muted-foreground">Get alerted when inventory falls below threshold.</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Daily Summary Report</Label>
                <p className="text-sm text-muted-foreground">Email summary of daily operations.</p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" /> Security
            </CardTitle>
            <CardDescription>Manage access and security settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Require OTP on Login</Label>
                <p className="text-sm text-muted-foreground">Always require email verification.</p>
              </div>
              <Switch defaultChecked disabled />
            </div>
            <div className="pt-4">
              <Button variant="outline" className="text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive">
                Revoke All Sessions
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end pt-4 pb-12">
        <Button onClick={handleSave} className="px-8">
          <Save className="w-4 h-4 mr-2" /> Save Changes
        </Button>
      </div>
    </div>
  );
}
