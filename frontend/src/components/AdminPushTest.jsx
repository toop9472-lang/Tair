// طير — Admin: send a test push notification to any user
import React, { useState } from "react";
import axios from "axios";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Bell, Send, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "../hooks/use-toast";

const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminPushTest() {
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const send = async () => {
    if (!userId.trim()) {
      toast({ title: "أدخل معرّف المستخدم", variant: "destructive" });
      return;
    }
    setLoading(true);
    setLastResult(null);
    try {
      const { data } = await axios.post(
        `${API}/api/mobile/push/test?user_id=${encodeURIComponent(userId.trim())}`,
      );
      setLastResult({ ok: true, data });
      toast({
        title: "تم إرسال الإشعار",
        description: `تم توجيه الإشعار إلى ${data?.targets || 0} جهاز`,
      });
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message || "فشل الإرسال";
      setLastResult({ ok: false, error: msg });
      toast({ title: "فشل الإرسال", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-[#111118] border-white/10" data-testid="admin-push-test-card">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Bell className="w-5 h-5 text-teal-400" />
          اختبار الإشعارات الفورية
        </CardTitle>
        <CardDescription className="text-gray-400 text-right leading-relaxed">
          أرسل إشعاراً تجريبياً إلى أي مستخدم مسجّل. يستخدم خدمة Expo Push (تصل لـ iOS و Android).
          تأكد أن المستخدم فتح التطبيق مرة واحدة على الأقل ومنح صلاحية الإشعارات.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-xs text-gray-400 mb-1 block text-right">
            معرّف المستخدم (user_id)
          </label>
          <Input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="مثلاً: user_ab12cd34ef"
            className="bg-black/40 border-white/10 text-white text-right"
            data-testid="admin-push-user-input"
            dir="ltr"
          />
        </div>

        <Button
          onClick={send}
          disabled={loading}
          className="bg-teal-600 hover:bg-teal-500 text-white w-full"
          data-testid="admin-push-send-btn"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin ml-2" />
              جاري الإرسال…
            </>
          ) : (
            <>
              <Send className="w-4 h-4 ml-2" />
              إرسال إشعار تجريبي
            </>
          )}
        </Button>

        {lastResult && (
          <div
            className={`p-3 rounded-lg border text-right text-xs ${
              lastResult.ok
                ? "bg-emerald-950/40 border-emerald-800 text-emerald-200"
                : "bg-red-950/40 border-red-800 text-red-200"
            }`}
            data-testid="admin-push-result"
          >
            <div className="flex items-center gap-2 flex-row-reverse font-bold mb-2">
              {lastResult.ok ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              <span>{lastResult.ok ? "تم الإرسال" : "خطأ"}</span>
            </div>
            <pre className="bg-black/40 p-2 rounded overflow-x-auto text-xs" dir="ltr">
              {JSON.stringify(lastResult.data || { error: lastResult.error }, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
