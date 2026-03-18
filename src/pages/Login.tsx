import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogIn } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import BrandMark from "@/components/BrandMark";

const Login = () => {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn, user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      toast.error("Please enter both login and password");
      return;
    }

    setLoading(true);
    
    await signIn(identifier, password);
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg border-border/50">
        <CardHeader className="space-y-3 text-center">
          <BrandMark className="mx-auto mb-2 h-16 w-16" />
          <CardTitle className="text-2xl font-semibold">Welcome to PlayPal</CardTitle>
          <CardDescription className="text-base">
            Sign in to manage your venue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">Email or username</Label>
              <Input
                id="identifier"
                type="text"
                placeholder="Enter email or username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="h-11"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11"
                disabled={loading}
              />
            </div>
            <Button 
              type="submit" 
              variant="cta" 
              className="w-full h-11 text-base"
              disabled={loading}
            >
              <>
                <LogIn className="mr-2 h-5 w-5" />
                {loading ? "Signing in..." : "Sign in"}
              </>
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-2">
            Portal admins and internal users can sign in with email or username.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
