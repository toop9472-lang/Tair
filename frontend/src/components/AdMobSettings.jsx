import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { 
  Play, 
  Gift, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Tv,
  DollarSign,
  Clock,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * AdMob Settings Component for Admin Panel
 * Manages Google AdMob integration for rewarded video ads
 */
const AdMobSettings = ({ adminToken }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    admob_enabled: false,
    admob_publisher_id: 'pub-5132559433385403',
    admob_app_id_android: '',
    admob_app_id_ios: '',
    admob_rewarded_ad_unit_android: '',
    admob_rewarded_ad_unit_ios: '',
    points_per_rewarded_ad: 5,
    daily_rewarded_ad_limit: 20,
    cooldown_seconds: 30,
    verification_pending: true
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/settings/admob`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      if (response.data) {
        setSettings(prev => ({ ...prev, ...response.data }));
      }
    } catch (error) {
      console.error('Failed to load AdMob settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/settings/admob`, settings, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      toast.success('تم حفظ إعدادات AdMob بنجاح');
    } catch (error) {
      console.error('Failed to save AdMob settings:', error);
      toast.error('فشل في حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <Card className={`border-2 ${settings.admob_enabled ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${settings.admob_enabled ? 'bg-green-500' : 'bg-gray-400'}`}>
                <Tv className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Google AdMob</h3>
                <p className="text-sm text-gray-600">
                  {settings.admob_enabled ? 'مفعل - جاهز للإعلانات' : 'غير مفعل'}
                </p>
              </div>
            </div>
            <Switch
              checked={settings.admob_enabled}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, admob_enabled: checked }))}
            />
          </div>

          {settings.verification_pending && (
            <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <span className="text-sm text-yellow-800 font-medium">
                  حساب AdMob في انتظار التوثيق. الإعلانات ستعمل بعد اكتمال التحقق.
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Publisher Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-500" />
            معلومات الناشر
          </CardTitle>
          <CardDescription>
            معرّف حساب Google AdMob الخاص بك
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Publisher ID</Label>
            <Input
              value={settings.admob_publisher_id}
              onChange={(e) => setSettings(prev => ({ ...prev, admob_publisher_id: e.target.value }))}
              placeholder="pub-XXXXXXXXXXXXXXXX"
              dir="ltr"
              className="font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              معرّف الناشر من حساب AdMob الخاص بك
            </p>
          </div>
        </CardContent>
      </Card>

      {/* App IDs */}
      <Card>
        <CardHeader>
          <CardTitle>معرّفات التطبيق</CardTitle>
          <CardDescription>
            معرّفات التطبيق لكل منصة من لوحة AdMob
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-2">
                <span className="text-green-500">🤖</span> Android App ID
              </Label>
              <Input
                value={settings.admob_app_id_android}
                onChange={(e) => setSettings(prev => ({ ...prev, admob_app_id_android: e.target.value }))}
                placeholder="ca-app-pub-XXXX~XXXX"
                dir="ltr"
                className="font-mono text-sm"
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <span>🍎</span> iOS App ID
              </Label>
              <Input
                value={settings.admob_app_id_ios}
                onChange={(e) => setSettings(prev => ({ ...prev, admob_app_id_ios: e.target.value }))}
                placeholder="ca-app-pub-XXXX~XXXX"
                dir="ltr"
                className="font-mono text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ad Unit IDs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-purple-500" />
            وحدات الإعلانات المكافآتية
          </CardTitle>
          <CardDescription>
            Rewarded Video Ad Unit IDs لكل منصة
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-2">
                <span className="text-green-500">🤖</span> Android Rewarded Ad
              </Label>
              <Input
                value={settings.admob_rewarded_ad_unit_android}
                onChange={(e) => setSettings(prev => ({ ...prev, admob_rewarded_ad_unit_android: e.target.value }))}
                placeholder="ca-app-pub-XXXX/XXXX"
                dir="ltr"
                className="font-mono text-sm"
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <span>🍎</span> iOS Rewarded Ad
              </Label>
              <Input
                value={settings.admob_rewarded_ad_unit_ios}
                onChange={(e) => setSettings(prev => ({ ...prev, admob_rewarded_ad_unit_ios: e.target.value }))}
                placeholder="ca-app-pub-XXXX/XXXX"
                dir="ltr"
                className="font-mono text-sm"
              />
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-800 mb-2">💡 كيفية الحصول على Ad Unit ID:</h4>
            <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
              <li>اذهب إلى <a href="https://admob.google.com" target="_blank" rel="noopener noreferrer" className="underline">admob.google.com</a></li>
              <li>اختر تطبيقك أو أنشئ تطبيق جديد</li>
              <li>اضغط على "Ad units" ثم "Add ad unit"</li>
              <li>اختر "Rewarded" وأنشئ الوحدة</li>
              <li>انسخ الـ Ad unit ID</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Rewards Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-yellow-500" />
            إعدادات المكافآت
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="flex items-center gap-2">
                <Gift className="w-4 h-4" /> نقاط لكل إعلان
              </Label>
              <Input
                type="number"
                value={settings.points_per_rewarded_ad}
                onChange={(e) => setSettings(prev => ({ ...prev, points_per_rewarded_ad: parseInt(e.target.value) || 0 }))}
                min={1}
                max={100}
              />
              <p className="text-xs text-gray-500 mt-1">النقاط الممنوحة لمشاهدة إعلان كامل</p>
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <Eye className="w-4 h-4" /> الحد اليومي
              </Label>
              <Input
                type="number"
                value={settings.daily_rewarded_ad_limit}
                onChange={(e) => setSettings(prev => ({ ...prev, daily_rewarded_ad_limit: parseInt(e.target.value) || 0 }))}
                min={1}
                max={100}
              />
              <p className="text-xs text-gray-500 mt-1">أقصى عدد إعلانات يومياً</p>
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4" /> فترة الانتظار (ثواني)
              </Label>
              <Input
                type="number"
                value={settings.cooldown_seconds}
                onChange={(e) => setSettings(prev => ({ ...prev, cooldown_seconds: parseInt(e.target.value) || 0 }))}
                min={0}
                max={300}
              />
              <p className="text-xs text-gray-500 mt-1">الانتظار بين الإعلانات</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button
        onClick={saveSettings}
        disabled={saving}
        className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600"
      >
        {saving ? (
          <Loader2 className="w-5 h-5 animate-spin ml-2" />
        ) : (
          <CheckCircle className="w-5 h-5 ml-2" />
        )}
        حفظ إعدادات AdMob
      </Button>

      {/* Test Info */}
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="pt-4">
          <h4 className="font-medium text-orange-800 mb-2">⚠️ للاختبار فقط:</h4>
          <p className="text-sm text-orange-700">
            يمكنك استخدام معرّفات الاختبار من Google للتجربة قبل التوثيق:
          </p>
          <div className="mt-2 p-2 bg-white rounded border font-mono text-xs">
            <p><strong>Android:</strong> ca-app-pub-3940256099942544/5224354917</p>
            <p><strong>iOS:</strong> ca-app-pub-3940256099942544/1712485313</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdMobSettings;
