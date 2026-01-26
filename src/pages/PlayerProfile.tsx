import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { apiFetch } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

type MembershipType = {
  id: string;
  name: string;
};

type PlayerDetail = {
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
  start_date: string | null;
  end_date: string | null;
};

type PlayerNote = {
  id: string;
  note: string;
  created_at: string;
  created_by: string | null;
};

type PlayerBooking = {
  id: string;
  booking_number: string | null;
  date: string | null;
  time: string | null;
  start_at: string | null;
  end_at: string | null;
  amount: string | null;
  status: string;
  membership_type: string | null;
  final_price: number | null;
  created_at: string;
};

const PlayerProfile = () => {
  const { playerId } = useParams<{ playerId: string }>();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [notes, setNotes] = useState<PlayerNote[]>([]);
  const [bookings, setBookings] = useState<PlayerBooking[]>([]);
  const [membershipTypes, setMembershipTypes] = useState<MembershipType[]>([]);
  const [loading, setLoading] = useState(true);
  const [membershipForm, setMembershipForm] = useState({
    membershipTypeId: "",
    status: "active",
    startDate: "",
    endDate: "",
  });
  const [noteInput, setNoteInput] = useState("");

  const fetchPlayer = async () => {
    if (!playerId) return;
    try {
      setLoading(true);
      const data = (await apiFetch(`/crm/players/${playerId}`)) as {
        player: PlayerDetail;
        notes: PlayerNote[];
        bookings: PlayerBooking[];
      };
      setPlayer(data.player);
      setNotes(data.notes ?? []);
      setBookings(data.bookings ?? []);
      setMembershipForm({
        membershipTypeId: data.player.membership_type_id ?? "",
        status: data.player.membership_status ?? "active",
        startDate: data.player.start_date ?? "",
        endDate: data.player.end_date ?? "",
      });
    } catch (error) {
      toast({
        title: "Failed to load player",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMembershipTypes = async () => {
    try {
      const data = (await apiFetch("/crm/memberships")) as MembershipType[];
      setMembershipTypes(data ?? []);
    } catch {
      setMembershipTypes([]);
    }
  };

  useEffect(() => {
    fetchPlayer();
    fetchMembershipTypes();
  }, [playerId]);

  const tags = useMemo(() => player?.tags ?? [], [player]);

  const handleSaveMembership = async () => {
    if (!playerId) return;
    try {
      await apiFetch(`/crm/players/${playerId}/membership`, {
        method: "POST",
        body: JSON.stringify({
          membershipTypeId: membershipForm.membershipTypeId || null,
          status: membershipForm.status || "active",
          startDate: membershipForm.startDate || null,
          endDate: membershipForm.endDate || null,
        }),
      });
      await fetchPlayer();
      toast({ title: "Membership updated" });
    } catch (error) {
      toast({
        title: "Failed to update membership",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleAddNote = async () => {
    if (!playerId || !noteInput.trim()) return;
    try {
      await apiFetch(`/crm/players/${playerId}/notes`, {
        method: "POST",
        body: JSON.stringify({ note: noteInput.trim() }),
      });
      setNoteInput("");
      await fetchPlayer();
    } catch (error) {
      toast({
        title: "Failed to add note",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-sm text-muted-foreground">Loading player...</div>
      </DashboardLayout>
    );
  }

  if (!player) {
    return (
      <DashboardLayout>
        <div className="text-sm text-muted-foreground">Player not found.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/membership")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to CRM
            </Button>
            <h1 className="text-3xl font-semibold tracking-tight">{player.name}</h1>
            <p className="text-muted-foreground mt-1">
              {player.phone || "—"} · {player.email || "—"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.length === 0 ? (
              <Badge variant="outline">No tags</Badge>
            ) : (
              tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Total bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{player.total_bookings}</div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Total spend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">฿{Number(player.total_spend).toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Last visit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {player.last_visit
                  ? new Date(player.last_visit).toLocaleString("en-GB", { hour12: false })
                  : "—"}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Membership</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Membership type</Label>
              <Select
                value={membershipForm.membershipTypeId || "none"}
                onValueChange={(value) =>
                  setMembershipForm({
                    ...membershipForm,
                    membershipTypeId: value === "none" ? "" : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select membership" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No membership</SelectItem>
                  {membershipTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={membershipForm.status}
                onValueChange={(value) => setMembershipForm({ ...membershipForm, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start date</Label>
              <Input
                type="date"
                value={membershipForm.startDate}
                onChange={(e) =>
                  setMembershipForm({ ...membershipForm, startDate: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>End date</Label>
              <Input
                type="date"
                value={membershipForm.endDate}
                onChange={(e) =>
                  setMembershipForm({ ...membershipForm, endDate: e.target.value })
                }
              />
            </div>
            <div className="md:col-span-4">
              <Button variant="cta" onClick={handleSaveMembership}>
                Save membership
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Add note</Label>
                <Input
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Internal note"
                />
                <Button variant="outline" onClick={handleAddNote}>
                  Add note
                </Button>
              </div>
              {notes.length === 0 ? (
                <div className="text-sm text-muted-foreground">No notes yet.</div>
              ) : (
                <div className="space-y-2">
                  {notes.map((note) => (
                    <div key={note.id} className="rounded-lg border border-border p-3">
                      <div className="text-sm">{note.note}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(note.created_at).toLocaleString("en-GB", { hour12: false })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Booking history</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Booking ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                        No bookings yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    bookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell>{booking.booking_number ?? booking.id}</TableCell>
                        <TableCell>
                          {booking.date && booking.time
                            ? `${booking.date} ${booking.time}`
                            : new Date(booking.created_at).toLocaleString("en-GB", {
                                hour12: false,
                              })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{booking.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          ฿{Number(booking.final_price ?? booking.amount ?? 0).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PlayerProfile;
