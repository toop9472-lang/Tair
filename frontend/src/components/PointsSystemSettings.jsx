import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { 
  Coins, Save, RefreshCw, Plus, Trash2, Edit2, Calendar,
  Percent, Gift, Clock, TrendingUp, Star, Zap, X, Check
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const PointsSystemSettings = () => {
  const [settings, setSettings] = useState({
    points_per_dollar: 500,
    points_per_sar: 133,
    points_per_minute_watching: 1,
    min_watch_seconds: 30,
    max_ads_per_10_minutes: 5,
    min_withdrawal_points: 500,
    withdrawal_fee_percent: 0,
    daily_login_bonus: 5,
    referral_bonus: 50,
    first_ad_bonus: 10
  });

  const [promotions, setPromotions] = useState([]);
  const [presets, setPresets] = useState([]);
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);
  const [promoForm, setPromoForm] = useState({
    name: '',
    name_en: '',
    description: '',
    multiplier: 2.0,
    bonus_points: 0,
    start_date: '',
    end_date: '',
    applies_to: ['watching', 'rewarded'],
    banner_color: '#F59E0B',
    icon: '🎉'
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [settingsRes, promosRes, presetsRes] = await Promise.all([
        axios.get(`${API}/api/points-settings/settings`, { headers: getAuthHeaders() }),
        axios.get(`${API}/api/points-settings/promotions`, { headers: getAuthHeaders() }),
        axios.get(`${API}/api/points-settings/preset-seasons`, { headers: getAuthHeaders() })
      ]);
      setSettings(prev => ({ ...prev, ...settingsRes.data }));
      setPromotions(promosRes.data.promotions || []);
      setPresets(presetsRes.data.presets || []);
    } catch (error) {
      console.error('Failed to load:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      await axios.put(`${API}/api/points-settings/settings`, settings, {
        headers: getAuthHeaders()
      });
      toast.success('تم حفظ إعدادات النقاط');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'فشل الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  const createPromotion = async () => {
    try {
      const data = {
        ...promoForm,
        start_date: new Date(promoForm.start_date).toISOString(),
        end_date: new Date(promoForm.end_date).toISOString()
      };

      if (editingPromo) {
        await axios.put(`${API}/api/points-settings/promotions/${editingPromo}`, data, {
          headers: getAuthHeaders()
        });
        toast.success('تم تحديث العرض');
      } else {
        await axios.post(`${API}/api/points-settings/promotions`, data, {
          headers: getAuthHeaders()
        });
        toast.success('تم إنشاء العرض');
      }

      setShowPromoForm(false);
      setEditingPromo(null);
      resetPromoForm();
      loadAll();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'فشل الحفظ');
    }
  };

  const deletePromotion = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا العرض؟')) return;
    try {
      await axios.delete(`${API}/api/points-settings/promotions/${id}`, {
        headers: getAuthHeaders()
      });
      toast.success('تم حذف العرض');
      loadAll();
    } catch (error) {
      toast.error('فشل الحذف');
    }
  };

  const togglePromotion = async (id) => {
    try {
      const res = await axios.post(`${API}/api/points-settings/promotions/${id}/toggle`, {}, {
        headers: getAuthHeaders()
      });
      toast.success(res.data.message);
      loadAll();
    } catch (error) {
      toast.error('فشل التبديل');
    }
  };

  const applyPreset = (preset) => {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    setPromoForm({
      name: preset.name,
      name_en: preset.name_en,
      description: preset.description,
      multiplier: preset.multiplier,
      bonus_points: preset.bonus_points,
      start_date: now.toISOString().slice(0, 16),
      end_date: nextWeek.toISOString().slice(0, 16),
      applies_to: ['watching', 'rewarded'],
      banner_color: preset.banner_color,
      icon: preset.icon
    });
    setShowPromoForm(true);
  };

  const resetPromoForm = () => {
    setPromoForm({
      name: '',
      name_en: '',
      description: '',
      multiplier: 2.0,
      bonus_points: 0,
      start_date: '',
      end_date: '',
      applies_to: ['watching', 'rewarded'],
      banner_color: '#F59E0B',
      icon: '🎉'
    });
  };

  const editPromotion = (promo) => {
    setPromoForm({
      name: promo.name,
      name_en: promo.name_en || '',
      description: promo.description || '',
      multiplier: promo.multiplier,
      bonus_points: promo.bonus_points || 0,
      start_date: new Date(promo.start_date).toISOString().slice(0, 16),
      end_date: new Date(promo.end_date).toISOString().slice(0, 16),
      applies_to: promo.applies_to || ['watching', 'rewarded'],
      banner_color: promo.banner_color || '#F59E0B',
      icon: promo.icon || '🎉'
    });
    setEditingPromo(promo.id);
    setShowPromoForm(true);
  };

  const isPromoActive = (promo) => {
    const now = new Date();
    return promo.is_active && 
           new Date(promo.start_date) <= now && 
           new Date(promo.end_date) >= now;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Coins className="w-7 h-7 text-yellow-500" />
          نظام النقاط والمكافآت
        </h2>
        <p className="text-gray-500 mt-1">إدارة معدلات التحويل والعروض الموسمية</p>
      </div>

      {/* Base Conversion Rates */}
      <Card className="border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-yellow-600" />
            معدلات التحويل الأساسية
          </CardTitle>
          <CardDescription>تحديد قيمة النقاط مقابل العملات</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-white rounded-xl border-2 border-green-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">💵</span>
                </div>
                <div>
                  <Label className="text-lg font-bold">نقاط لكل دولار</Label>
                  <p className="text-xs text-gray-500">كم نقطة = 1 دولار</p>
                </div>
              </div>
              <Input
                type="number"
                value={settings.points_per_dollar}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  points_per_dollar: parseInt(e.target.value) || 500 
                }))}
                min="100"
                max="10000"
                className="text-2xl font-bold text-center h-14"
              />
              <p className="text-center text-sm text-gray-500 mt-2">
                {settings.points_per_dollar} نقطة = $1.00
              </p>
            </div>

            <div className="p-4 bg-white rounded-xl border-2 border-blue-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl">🇸🇦</span>
                </div>
                <div>
                  <Label className="text-lg font-bold">نقاط لكل ريال</Label>
                  <p className="text-xs text-gray-500">كم نقطة = 1 ريال سعودي</p>
                </div>
              </div>
              <Input
                type="number"
                value={settings.points_per_sar}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  points_per_sar: parseInt(e.target.value) || 133 
                }))}
                min="10"
                max="5000"
                className="text-2xl font-bold text-center h-14"
              />
              <p className="text-center text-sm text-gray-500 mt-2">
                {settings.points_per_sar} نقطة = 1 ر.س
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Earning Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-purple-600" />
            إعدادات الكسب
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>نقاط لكل دقيقة مشاهدة</Label>
              <Input
                type="number"
                value={settings.points_per_minute_watching}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  points_per_minute_watching: parseInt(e.target.value) || 1 
                }))}
                min="1"
                max="10"
              />
            </div>
            <div>
              <Label>الحد الأدنى للمشاهدة (ثانية)</Label>
              <Input
                type="number"
                value={settings.min_watch_seconds}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  min_watch_seconds: parseInt(e.target.value) || 30 
                }))}
                min="10"
                max="120"
              />
            </div>
            <div>
              <Label>أقصى إعلانات / 10 دقائق</Label>
              <Input
                type="number"
                value={settings.max_ads_per_10_minutes}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  max_ads_per_10_minutes: parseInt(e.target.value) || 5 
                }))}
                min="1"
                max="20"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Withdrawal & Bonuses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Percent className="w-5 h-5 text-red-500" />
              إعدادات السحب
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>الحد الأدنى للسحب (نقطة)</Label>
              <Input
                type="number"
                value={settings.min_withdrawal_points}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  min_withdrawal_points: parseInt(e.target.value) || 500 
                }))}
                min="100"
              />
              <p className="text-xs text-gray-500 mt-1">
                = ${(settings.min_withdrawal_points / settings.points_per_dollar).toFixed(2)}
              </p>
            </div>
            <div>
              <Label>رسوم السحب (%)</Label>
              <Input
                type="number"
                value={settings.withdrawal_fee_percent}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  withdrawal_fee_percent: parseFloat(e.target.value) || 0 
                }))}
                min="0"
                max="10"
                step="0.5"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Star className="w-5 h-5 text-yellow-500" />
              المكافآت الإضافية
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>مكافأة الدخول اليومي</Label>
              <Input
                type="number"
                value={settings.daily_login_bonus}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  daily_login_bonus: parseInt(e.target.value) || 5 
                }))}
                min="0"
                max="100"
              />
            </div>
            <div>
              <Label>مكافأة الإحالة</Label>
              <Input
                type="number"
                value={settings.referral_bonus}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  referral_bonus: parseInt(e.target.value) || 50 
                }))}
                min="0"
                max="500"
              />
            </div>
            <div>
              <Label>مكافأة أول إعلان يومياً</Label>
              <Input
                type="number"
                value={settings.first_ad_bonus}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  first_ad_bonus: parseInt(e.target.value) || 10 
                }))}
                min="0"
                max="50"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <Button 
        onClick={saveSettings} 
        disabled={isSaving}
        className="w-full bg-gradient-to-r from-yellow-500 to-orange-500"
        size="lg"
      >
        {isSaving ? <RefreshCw className="w-5 h-5 animate-spin ml-2" /> : <Save className="w-5 h-5 ml-2" />}
        حفظ إعدادات النقاط
      </Button>

      {/* Promotions Section */}
      <Card className="border-2 border-purple-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-600" />
                العروض والمواسم
              </CardTitle>
              <CardDescription>مضاعفة النقاط في المناسبات الخاصة</CardDescription>
            </div>
            <Button onClick={() => { resetPromoForm(); setEditingPromo(null); setShowPromoForm(true); }}>
              <Plus className="w-4 h-4 ml-2" />
              عرض جديد
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Preset Templates */}
          <div className="mb-6">
            <Label className="text-sm text-gray-500 mb-2 block">قوالب جاهزة:</Label>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <Button
                  key={preset.id}
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(preset)}
                  className="text-xs"
                  style={{ borderColor: preset.banner_color, color: preset.banner_color }}
                >
                  {preset.icon} {preset.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Active Promotions */}
          {promotions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>لا توجد عروض حالياً</p>
            </div>
          ) : (
            <div className="space-y-3">
              {promotions.map((promo) => (
                <div
                  key={promo.id}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    isPromoActive(promo) 
                      ? 'border-green-300 bg-green-50' 
                      : promo.is_active 
                        ? 'border-yellow-200 bg-yellow-50'
                        : 'border-gray-200 bg-gray-50 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                        style={{ backgroundColor: promo.banner_color + '20' }}
                      >
                        {promo.icon}
                      </div>
                      <div>
                        <h4 className="font-bold">{promo.name}</h4>
                        <p className="text-sm text-gray-500">
                          {promo.multiplier}x نقاط
                          {promo.bonus_points > 0 && ` + ${promo.bonus_points} إضافي`}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(promo.start_date).toLocaleDateString('ar-SA')} - {new Date(promo.end_date).toLocaleDateString('ar-SA')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isPromoActive(promo) && (
                        <span className="px-2 py-1 bg-green-500 text-white text-xs rounded-full">
                          نشط الآن
                        </span>
                      )}
                      <Switch
                        checked={promo.is_active}
                        onCheckedChange={() => togglePromotion(promo.id)}
                      />
                      <Button size="sm" variant="ghost" onClick={() => editPromotion(promo)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-500" onClick={() => deletePromotion(promo.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Promotion Form Modal */}
      {showPromoForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{editingPromo ? 'تعديل العرض' : 'عرض جديد'}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowPromoForm(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>الأيقونة</Label>
                  <Input
                    value={promoForm.icon}
                    onChange={(e) => setPromoForm(prev => ({ ...prev, icon: e.target.value }))}
                    className="text-2xl text-center"
                    maxLength={2}
                  />
                </div>
                <div>
                  <Label>لون البانر</Label>
                  <Input
                    type="color"
                    value={promoForm.banner_color}
                    onChange={(e) => setPromoForm(prev => ({ ...prev, banner_color: e.target.value }))}
                    className="h-10"
                  />
                </div>
              </div>

              <div>
                <Label>اسم العرض (عربي)</Label>
                <Input
                  value={promoForm.name}
                  onChange={(e) => setPromoForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="مثال: عروض رمضان"
                />
              </div>

              <div>
                <Label>الوصف</Label>
                <Input
                  value={promoForm.description}
                  onChange={(e) => setPromoForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="وصف مختصر للعرض"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>مضاعف النقاط</Label>
                  <Input
                    type="number"
                    value={promoForm.multiplier}
                    onChange={(e) => setPromoForm(prev => ({ ...prev, multiplier: parseFloat(e.target.value) || 1 }))}
                    min="1"
                    max="10"
                    step="0.5"
                  />
                  <p className="text-xs text-gray-500 mt-1">{promoForm.multiplier}x = نقاط مضاعفة</p>
                </div>
                <div>
                  <Label>نقاط إضافية</Label>
                  <Input
                    type="number"
                    value={promoForm.bonus_points}
                    onChange={(e) => setPromoForm(prev => ({ ...prev, bonus_points: parseInt(e.target.value) || 0 }))}
                    min="0"
                    max="100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>تاريخ البداية</Label>
                  <Input
                    type="datetime-local"
                    value={promoForm.start_date}
                    onChange={(e) => setPromoForm(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>تاريخ الانتهاء</Label>
                  <Input
                    type="datetime-local"
                    value={promoForm.end_date}
                    onChange={(e) => setPromoForm(prev => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
              </div>

              <Button onClick={createPromotion} className="w-full">
                <Check className="w-4 h-4 ml-2" />
                {editingPromo ? 'تحديث العرض' : 'إنشاء العرض'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default PointsSystemSettings;
