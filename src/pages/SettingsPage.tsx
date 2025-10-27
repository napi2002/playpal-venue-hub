import DashboardLayout from "@/components/DashboardLayout";

const SettingsPage = () => {
  return (
    <DashboardLayout>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">Configure venue settings and preferences</p>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
