import DashboardLayout from "@/components/DashboardLayout";

const Payments = () => {
  return (
    <DashboardLayout>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Payments & Payouts</h1>
        <p className="text-muted-foreground mt-2">Track transactions and manage payouts</p>
      </div>
    </DashboardLayout>
  );
};

export default Payments;
