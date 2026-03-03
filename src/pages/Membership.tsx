import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiClient";
import { Search, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PAGE_SIZE = 10;

type PlayerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  tags: string[] | null;
  total_bookings: number;
  total_spend: number;
  last_visit: string | null;
  membership_status: string | null;
  membership_type_id: string | null;
  membership_type_name: string | null;
};

type MembershipType = {
  id: string;
  name: string;
  description_public: string | null;
  description_internal: string | null;
  status: string;
  fixed_hourly_rate: number | null;
  percent_discount: number | null;
  early_booking_hours: number | null;
  auto_confirm: boolean;
  allow_peak: boolean;
  cancellation_window_hours: number | null;
  no_show_forgiveness: boolean;
};

type PlayersResponse = {
  data: PlayerRow[];
  total: number;
};

const Membership = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [membershipFilter, setMembershipFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [playersError, setPlayersError] = useState<string | null>(null);

  const [membershipTypes, setMembershipTypes] = useState<MembershipType[]>([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [typesError, setTypesError] = useState<string | null>(null);

  const [playerDialogOpen, setPlayerDialogOpen] = useState(false);
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [newPlayer, setNewPlayer] = useState({
    name: "",
    phone: "",
    email: "",
    tags: "",
  });
  const [newType, setNewType] = useState({
    name: "",
    description_public: "",
    description_internal: "",
    status: "active",
    fixed_hourly_rate: "",
    percent_discount: "",
    auto_confirm: false,
    allow_peak: true,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const playerQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (membershipFilter !== "all") params.set("membershipTypeId", membershipFilter);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    return params.toString();
  }, [membershipFilter, page, searchQuery]);

  const fetchPlayers = useCallback(async () => {
    try {
      setPlayersLoading(true);
      setPlayersError(null);
      const response = (await apiFetch(`/crm/players?${playerQuery}`)) as PlayersResponse;
      setPlayers(response.data ?? []);
      setTotalPlayers(response.total ?? 0);
    } catch (error) {
      setPlayersError(error instanceof Error ? error.message : "Failed to load players");
    } finally {
      setPlayersLoading(false);
    }
  }, [playerQuery]);

  const fetchMembershipTypes = useCallback(async () => {
    try {
      setTypesLoading(true);
      setTypesError(null);
      const data = (await apiFetch("/crm/memberships")) as MembershipType[];
      setMembershipTypes(data ?? []);
    } catch (error) {
      setTypesError(error instanceof Error ? error.message : "Failed to load membership types");
    } finally {
      setTypesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  useEffect(() => {
    fetchMembershipTypes();
  }, [fetchMembershipTypes]);

  const totalPages = Math.max(1, Math.ceil(totalPlayers / PAGE_SIZE));

  const handleCreatePlayer = async () => {
    try {
      if (!newPlayer.name.trim()) {
        toast({ title: "Name is required", variant: "destructive" });
        return;
      }
      const tags = newPlayer.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      await apiFetch("/crm/players", {
        method: "POST",
        body: JSON.stringify({
          name: newPlayer.name.trim(),
          phone: newPlayer.phone.trim() || null,
          email: newPlayer.email.trim() || null,
          tags,
        }),
      });
      setPlayerDialogOpen(false);
      setNewPlayer({ name: "", phone: "", email: "", tags: "" });
      fetchPlayers();
    } catch (error) {
      toast({
        title: "Failed to create player",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleCreateType = async () => {
    try {
      if (!newType.name.trim()) {
        toast({ title: "Name is required", variant: "destructive" });
        return;
      }
      await apiFetch("/crm/memberships", {
        method: "POST",
        body: JSON.stringify({
          name: newType.name.trim(),
          description_public: newType.description_public || null,
          description_internal: newType.description_internal || null,
          status: newType.status,
          fixed_hourly_rate: newType.fixed_hourly_rate
            ? Number(newType.fixed_hourly_rate)
            : null,
          percent_discount: newType.percent_discount
            ? Number(newType.percent_discount)
            : null,
          auto_confirm: newType.auto_confirm,
          allow_peak: newType.allow_peak,
        }),
      });
      setTypeDialogOpen(false);
      setNewType({
        name: "",
        description_public: "",
        description_internal: "",
        status: "active",
        fixed_hourly_rate: "",
        percent_discount: "",
        auto_confirm: false,
        allow_peak: true,
      });
      fetchMembershipTypes();
    } catch (error) {
      toast({
        title: "Failed to create membership",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Membership CRM</h1>
            <p className="text-muted-foreground mt-1">
              Track player profiles, memberships, and pricing rules.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setTypeDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add membership type
            </Button>
            <Button variant="cta" onClick={() => setPlayerDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add player
            </Button>
          </div>
        </div>

        <Tabs defaultValue="players" className="space-y-4">
          <TabsList>
            <TabsTrigger value="players">Players</TabsTrigger>
            <TabsTrigger value="types">Membership Types</TabsTrigger>
          </TabsList>

          <TabsContent value="players" className="space-y-4">
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name, phone, or email"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Select value={membershipFilter} onValueChange={setMembershipFilter}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Membership type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All memberships</SelectItem>
                      {membershipTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Player</TableHead>
                        <TableHead>Membership</TableHead>
                        <TableHead>Tags</TableHead>
                        <TableHead>Total bookings</TableHead>
                        <TableHead>Total spend</TableHead>
                        <TableHead>Last visit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {playersLoading ? (
                        Array.from({ length: PAGE_SIZE }).map((_, index) => (
                          <TableRow key={`player-skeleton-${index}`} className="animate-pulse">
                            <TableCell colSpan={6}>
                              <div className="h-4 w-full rounded bg-muted" />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : playersError ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-destructive">
                            {playersError}
                          </TableCell>
                        </TableRow>
                      ) : players.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No players found
                          </TableCell>
                        </TableRow>
                      ) : (
                        players.map((player) => (
                          <TableRow
                            key={player.id}
                            className="hover:bg-muted/30 cursor-pointer"
                            onClick={() => navigate(`/membership/${player.id}`)}
                          >
                            <TableCell>
                              <div className="font-medium">{player.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {player.phone || "—"} · {player.email || "—"}
                              </div>
                            </TableCell>
                            <TableCell>
                              {player.membership_type_name ? (
                                <Badge variant="secondary">{player.membership_type_name}</Badge>
                              ) : (
                                <span className="text-sm text-muted-foreground">None</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {(player.tags ?? []).length === 0 ? (
                                  <span className="text-sm text-muted-foreground">—</span>
                                ) : (
                                  player.tags?.map((tag) => (
                                    <Badge key={tag} variant="outline" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{player.total_bookings}</TableCell>
                            <TableCell>฿{Number(player.total_spend).toFixed(2)}</TableCell>
                            <TableCell>
                              {player.last_visit
                                ? new Date(player.last_visit).toLocaleString("en-GB", {
                                    hour12: false,
                                  })
                                : "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      disabled={page === 1 || playersLoading}
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={page >= totalPages || playersLoading}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="types">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Membership types</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Pricing</TableHead>
                        <TableHead>Privileges</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {typesLoading ? (
                        Array.from({ length: 4 }).map((_, index) => (
                          <TableRow key={`type-skeleton-${index}`} className="animate-pulse">
                            <TableCell colSpan={4}>
                              <div className="h-4 w-full rounded bg-muted" />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : typesError ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-destructive">
                            {typesError}
                          </TableCell>
                        </TableRow>
                      ) : membershipTypes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            No membership types yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        membershipTypes.map((type) => (
                          <TableRow key={type.id}>
                            <TableCell>
                              <div className="font-medium">{type.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {type.description_internal || "—"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={type.status === "active" ? "secondary" : "outline"}>
                                {type.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {type.fixed_hourly_rate
                                ? `฿${Number(type.fixed_hourly_rate).toFixed(2)}/hr`
                                : type.percent_discount
                                  ? `${type.percent_discount}% off`
                                  : "Default"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {type.auto_confirm ? "Auto-confirm" : "Manual confirm"} ·{" "}
                              {type.allow_peak ? "Peak allowed" : "Peak restricted"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={playerDialogOpen} onOpenChange={setPlayerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add player</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={newPlayer.name}
                onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={newPlayer.phone}
                onChange={(e) => setNewPlayer({ ...newPlayer, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={newPlayer.email}
                onChange={(e) => setNewPlayer({ ...newPlayer, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Tags (comma separated)</Label>
              <Input
                value={newPlayer.tags}
                onChange={(e) => setNewPlayer({ ...newPlayer, tags: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlayerDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="cta" onClick={handleCreatePlayer}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add membership type</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={newType.name}
                onChange={(e) => setNewType({ ...newType, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Internal description</Label>
              <Input
                value={newType.description_internal}
                onChange={(e) => setNewType({ ...newType, description_internal: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Public description</Label>
              <Input
                value={newType.description_public}
                onChange={(e) => setNewType({ ...newType, description_public: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Fixed hourly rate (THB)</Label>
                <Input
                  value={newType.fixed_hourly_rate}
                  onChange={(e) => setNewType({ ...newType, fixed_hourly_rate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Percent discount</Label>
                <Input
                  value={newType.percent_discount}
                  onChange={(e) => setNewType({ ...newType, percent_discount: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={newType.status}
                  onValueChange={(value) => setNewType({ ...newType, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Auto confirm</Label>
                <Select
                  value={newType.auto_confirm ? "yes" : "no"}
                  onValueChange={(value) =>
                    setNewType({ ...newType, auto_confirm: value === "yes" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTypeDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="cta" onClick={handleCreateType}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Membership;
