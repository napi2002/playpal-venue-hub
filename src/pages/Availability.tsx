import DashboardLayout from "@/components/DashboardLayout";

const Availability = () => {
  return (
    <DashboardLayout>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Availability Management</h1>
        <p className="text-muted-foreground mt-2">Set and manage court availability schedules</p>
      </div>
    </DashboardLayout>
  );
};

export default Availability;
