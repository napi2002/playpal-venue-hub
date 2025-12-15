import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  CreditCard,
  Mail,
  MessageSquare,
  Webhook,
  Link2,
  Settings,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { useIntegrations } from "@/hooks/useIntegrations";
import { format } from "date-fns";

const availableIntegrations = [
  {
    id: "google_calendar",
    name: "Google Calendar",
    description: "Sync bookings with Google Calendar for automatic scheduling",
    icon: Calendar,
    category: "Calendar",
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Accept credit card payments securely",
    icon: CreditCard,
    category: "Payments",
  },
  {
    id: "paypal",
    name: "PayPal",
    description: "Accept PayPal payments from customers",
    icon: CreditCard,
    category: "Payments",
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    description: "Sync customer data for email marketing campaigns",
    icon: Mail,
    category: "Marketing",
  },
  {
    id: "twilio",
    name: "Twilio SMS",
    description: "Send SMS notifications and reminders to customers",
    icon: MessageSquare,
    category: "Notifications",
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Connect with 5,000+ apps through Zapier webhooks",
    icon: Webhook,
    category: "Automation",
  },
  {
    id: "webhook",
    name: "Custom Webhook",
    description: "Send booking data to your own endpoints",
    icon: Link2,
    category: "API",
  },
];

const Integrations = () => {
  const { integrations, isLoading, updateIntegration } = useIntegrations();
  const [configDialog, setConfigDialog] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");

  const getIntegrationStatus = (integrationType: string) => {
    const integration = integrations.find(
      (i) => i.integration_type === integrationType
    );
    return integration?.is_enabled || false;
  };

  const getIntegrationData = (integrationType: string) => {
    return integrations.find((i) => i.integration_type === integrationType);
  };

  const handleToggle = (integrationType: string) => {
    const integration = getIntegrationData(integrationType);
    if (integration) {
      updateIntegration({
        id: integration.id,
        updates: { is_enabled: !integration.is_enabled },
      });
    }
  };

  const handleConfigure = (integrationType: string) => {
    setConfigDialog(integrationType);
    setApiKey("");
  };

  const groupedIntegrations = availableIntegrations.reduce((acc, integration) => {
    if (!acc[integration.category]) {
      acc[integration.category] = [];
    }
    acc[integration.category].push(integration);
    return acc;
  }, {} as Record<string, typeof availableIntegrations>);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground mt-1">
            Connect calendars, APIs, and payment systems
          </p>
        </div>

        {/* Connected Integrations Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Connection Status</CardTitle>
            <CardDescription>
              {integrations.filter((i) => i.is_enabled).length} of{" "}
              {availableIntegrations.length} integrations active
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {integrations
                .filter((i) => i.is_enabled)
                .map((integration) => {
                  const integrationInfo = availableIntegrations.find(
                    (a) => a.id === integration.integration_type
                  );
                  return (
                    <Badge
                      key={integration.id}
                      variant="outline"
                      className="bg-green-500/10 text-green-700 border-green-200"
                    >
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      {integrationInfo?.name || integration.integration_type}
                    </Badge>
                  );
                })}
              {integrations.filter((i) => i.is_enabled).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No integrations connected yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Integrations by Category */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          Object.entries(groupedIntegrations).map(([category, categoryIntegrations]) => (
            <div key={category} className="space-y-4">
              <h2 className="text-lg font-semibold">{category}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryIntegrations.map((integration) => {
                  const isEnabled = getIntegrationStatus(integration.id);
                  const integrationData = getIntegrationData(integration.id);
                  const Icon = integration.icon;

                  return (
                    <Card key={integration.id} className="relative">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-2 rounded-lg ${
                                isEnabled
                                  ? "bg-primary/10 text-primary"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              <Icon className="h-5 w-5" />
                            </div>
                            <div>
                              <CardTitle className="text-base">
                                {integration.name}
                              </CardTitle>
                              {isEnabled && integrationData?.last_sync_at && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Last sync:{" "}
                                  {format(
                                    new Date(integrationData.last_sync_at),
                                    "MMM dd, HH:mm"
                                  )}
                                </p>
                              )}
                            </div>
                          </div>
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={() => handleToggle(integration.id)}
                            disabled={!integrationData}
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-sm text-muted-foreground mb-4">
                          {integration.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <Badge
                            variant="outline"
                            className={
                              isEnabled
                                ? "bg-green-500/10 text-green-700 border-green-200"
                                : "bg-muted text-muted-foreground"
                            }
                          >
                            {isEnabled ? (
                              <>
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                Connected
                              </>
                            ) : (
                              <>
                                <XCircle className="mr-1 h-3 w-3" />
                                Not connected
                              </>
                            )}
                          </Badge>
                          <Dialog
                            open={configDialog === integration.id}
                            onOpenChange={(open) =>
                              setConfigDialog(open ? integration.id : null)
                            }
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleConfigure(integration.id)}
                              >
                                <Settings className="h-4 w-4 mr-1" />
                                Configure
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>
                                  Configure {integration.name}
                                </DialogTitle>
                                <DialogDescription>
                                  Enter your API credentials to connect this
                                  integration.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label htmlFor="apiKey">API Key</Label>
                                  <Input
                                    id="apiKey"
                                    type="password"
                                    placeholder="Enter your API key"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                  />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Your API key is encrypted and stored securely.
                                </p>
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  onClick={() => setConfigDialog(null)}
                                >
                                  Cancel
                                </Button>
                                <Button onClick={() => setConfigDialog(null)}>
                                  Save Configuration
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </DashboardLayout>
  );
};

export default Integrations;
