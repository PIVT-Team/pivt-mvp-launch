import { ShieldX, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function AccessDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <ShieldX className="w-8 h-8 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            You do not have permission to access this area. This section is restricted to authorized administrators only.
          </p>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <Link to="/">
            <ArrowLeft className="w-4 h-4" />
            Return to Platform
          </Link>
        </Button>
      </div>
    </div>
  );
}
