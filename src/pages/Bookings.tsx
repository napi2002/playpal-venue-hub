import DashboardLayout from "@/components/DashboardLayout";

const Bookings = () => {
  return (
    <DashboardLayout>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Bookings</h1>
        <p className="text-muted-foreground mt-2">View and manage all venue bookings</p>
      </div>
    </DashboardLayout>
  );
};

export default Bookings;
