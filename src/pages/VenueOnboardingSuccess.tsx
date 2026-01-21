import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const VenueOnboardingSuccess = () => {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Venue submitted</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Thanks for completing onboarding. Your venue is now submitted and ready for review.
            </p>
            <Button onClick={() => navigate("/dashboard")}>Go to dashboard</Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default VenueOnboardingSuccess;
