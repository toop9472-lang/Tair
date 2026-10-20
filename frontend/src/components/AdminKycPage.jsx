// طير — Admin KYC Review Panel
// Lists pending/approved/rejected KYC submissions and lets the admin approve or reject with one click.
import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { toast } from "../hooks/use-toast";
import { Check, X, RefreshCw, Truck, Store, FileText, Phone, MapPin, User as UserIcon } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_TABS = [
  { key: "pending", label: "قيد المراجعة", color: "bg-amber-500" },
  { key: "approved", label: "مقبولة", color: "bg-emerald-500" },
  { key: "rejected", label: "مرفوضة", color: "bg-rose-500" },
];

export default function AdminKycPage({ admin }) {
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [rejectNote, setRejectNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/kyc/admin/list`, { params: { status, limit: 200 } });
      setItems(r.data.items || []);
    } catch (e) {
      toast({ title: "تعذّر تحميل الطلبات", description: e.response?.data?.detail || e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const decide = async (decision) => {
    if (!selected) return;
    if (decision === "reject" && !rejectNote.trim()) {
      toast({ title: "أدخل سبب الرفض", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await axios.post(`${API}/kyc/admin/${selected.kyc_id}/decision`, null, {
        params: {
          decision,
          reviewer_id: admin?.email || admin?.id || "admin",
          note: decision === "reject" ? rejectNote.trim() : undefined,
        },
      });
      toast({ title: decision === "approve" ? "تم قبول التوثيق ✅" : "تم رفض التوثيق" });
      setSelected(null);
      setRejectNote("");
      await load();
    } catch (e) {
      toast({ title: "فشل الحفظ", description: e.response?.data?.detail || e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="bg-[#111118] border-white/10" data-testid="admin-kyc-page">
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between text-white">
          <span>لوحة توثيق الهوية (KYC)</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={load} data-testid="kyc-refresh-btn">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Status tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatus(t.key)}
              data-testid={`kyc-tab-${t.key}`}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${
                status === t.key
                  ? `${t.color} text-white shadow-lg`
                  : "bg-white/5 text-gray-300 hover:bg-white/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-400">جاري التحميل…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-10 text-gray-400" data-testid="kyc-empty">
            لا توجد طلبات في هذه الحالة.
          </div>
        ) : (
          <div className="grid gap-3">
            {items.map((it) => (
              <SubmissionRow
                key={it.kyc_id}
                item={it}
                onOpen={() => { setSelected(it); setRejectNote(""); }}
              />
            ))}
          </div>
        )}
      </CardContent>

      {selected && (
        <SubmissionModal
          item={selected}
          rejectNote={rejectNote}
          setRejectNote={setRejectNote}
          onClose={() => { setSelected(null); setRejectNote(""); }}
          onApprove={() => decide("approve")}
          onReject={() => decide("reject")}
          busy={busy}
        />
      )}
    </Card>
  );
}

function SubmissionRow({ item, onOpen }) {
  const RoleIcon = item.role === "shop" ? Store : Truck;
  const statusPill = {
    pending: "bg-amber-500/15 text-amber-400",
    approved: "bg-emerald-500/15 text-emerald-400",
    rejected: "bg-rose-500/15 text-rose-400",
  }[item.status] || "bg-white/10 text-gray-300";
  return (
    <div
      className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg p-4 flex flex-row-reverse items-center gap-3 cursor-pointer"
      onClick={onOpen}
      data-testid={`kyc-row-${item.kyc_id}`}
    >
      <div className={`w-11 h-11 rounded-full flex items-center justify-center ${item.role === "shop" ? "bg-blue-500/15" : "bg-teal-500/15"}`}>
        <RoleIcon className={item.role === "shop" ? "text-blue-400 w-5 h-5" : "text-teal-400 w-5 h-5"} />
      </div>
      <div className="flex-1 min-w-0 text-right">
        <div className="flex flex-row-reverse items-center gap-2 flex-wrap">
          <span className="text-white font-bold text-sm">{item.full_name}</span>
          <Badge className={`text-[10px] font-bold ${statusPill}`}>
            {item.status === "pending" ? "قيد المراجعة" : item.status === "approved" ? "مقبولة" : "مرفوضة"}
          </Badge>
          <Badge className="bg-white/5 text-gray-300 text-[10px] font-bold">
            {item.role === "shop" ? "متجر" : "ناقل"}
          </Badge>
        </div>
        <div className="text-xs text-gray-400 mt-1 flex flex-row-reverse gap-3 flex-wrap">
          <span className="flex flex-row-reverse items-center gap-1"><Phone className="w-3 h-3" /> {item.phone}</span>
          {item.city && <span className="flex flex-row-reverse items-center gap-1"><MapPin className="w-3 h-3" /> {item.city}</span>}
          <span className="flex flex-row-reverse items-center gap-1"><UserIcon className="w-3 h-3" /> {item.id_number}</span>
        </div>
      </div>
      <Button size="sm" variant="secondary" data-testid={`kyc-open-${item.kyc_id}`}>عرض</Button>
    </div>
  );
}

function SubmissionModal({ item, rejectNote, setRejectNote, onClose, onApprove, onReject, busy }) {
  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="kyc-modal-overlay"
    >
      <div
        className="bg-[#0d0d13] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <div className="sticky top-0 bg-[#0d0d13] border-b border-white/10 p-4 flex items-center justify-between">
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1" data-testid="kyc-close-modal">
            <X className="w-5 h-5" />
          </button>
          <h3 className="text-white font-bold text-base">مراجعة توثيق</h3>
          <Badge className={item.role === "shop" ? "bg-blue-500" : "bg-teal-500"}>
            {item.role === "shop" ? "متجر" : "ناقل"}
          </Badge>
        </div>

        <div className="p-5 space-y-4">
          <InfoRow label="الاسم الكامل" value={item.full_name} />
          <InfoRow label="رقم الهوية" value={item.id_number} />
          <InfoRow label="الجوال" value={item.phone} />
          {item.city && <InfoRow label="المدينة" value={item.city} />}
          {item.commercial_reg && <InfoRow label="السجل التجاري" value={item.commercial_reg} />}
          {item.notes && <InfoRow label="ملاحظات المُقدِّم" value={item.notes} />}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <DocPreview label="صورة الهوية (وجه)" url={item.id_front_url} />
            <DocPreview label="صورة الهوية (خلف)" url={item.id_back_url} />
            <DocPreview label="صورة شخصية (Selfie)" url={item.selfie_url} />
            {item.role === "shop" && (
              <DocPreview label="السجل التجاري" url={item.business_license_url} />
            )}
          </div>

          {item.status === "pending" ? (
            <>
              <div className="pt-2">
                <label className="text-xs text-gray-400 mb-1 block">سبب الرفض (إن وُجد)</label>
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="مثال: الصورة غير واضحة، يُرجى إعادة الرفع"
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white text-sm min-h-[70px]"
                  data-testid="kyc-reject-note"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button
                  onClick={onReject}
                  disabled={busy}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                  data-testid="kyc-reject-btn"
                >
                  <X className="w-4 h-4 ml-2" /> رفض
                </Button>
                <Button
                  onClick={onApprove}
                  disabled={busy}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  data-testid="kyc-approve-btn"
                >
                  <Check className="w-4 h-4 ml-2" /> قبول وتوثيق
                </Button>
              </div>
            </>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-gray-300 text-center">
              الحالة: <span className="font-bold text-white">{item.status === "approved" ? "مقبولة" : "مرفوضة"}</span>
              {item.review_note && <div className="text-xs text-gray-400 mt-1">{item.review_note}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-row-reverse items-center gap-3 text-sm">
      <span className="text-gray-400 min-w-[110px]">{label}:</span>
      <span className="text-white font-semibold">{value}</span>
    </div>
  );
}

function DocPreview({ label, url }) {
  if (!url) {
    return (
      <div className="bg-white/5 border border-dashed border-white/10 rounded-lg p-3 text-center text-gray-500 text-xs">
        <FileText className="w-5 h-5 mx-auto mb-1 opacity-50" />
        {label}
        <div className="text-[10px] text-gray-600 mt-1">لم يُرفَع</div>
      </div>
    );
  }
  const isPdf = url.toLowerCase().endsWith(".pdf");
  return (
    <a href={url} target="_blank" rel="noreferrer" className="group block bg-white/5 border border-white/10 rounded-lg overflow-hidden hover:border-teal-400 transition">
      {isPdf ? (
        <div className="aspect-video flex items-center justify-center bg-white/5 text-teal-400">
          <FileText className="w-10 h-10" />
        </div>
      ) : (
        <img src={url} alt={label} className="w-full aspect-video object-cover group-hover:scale-105 transition" />
      )}
      <div className="px-2 py-1 text-[11px] text-gray-300 text-center">{label}</div>
    </a>
  );
}
