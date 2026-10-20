import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from '../hooks/use-toast';
import { 
  Key, CreditCard, Shield, Eye, EyeOff, Save, RefreshCw, 
  AlertTriangle, Settings, Wrench, Globe, Phone, Mail,
  Users, DollarSign, TrendingUp, Activity, Power, Ban,
  MessageSquare, Link, Clock, Wallet, Send, CheckCircle, XCircle, Gift,
  FileText, Bell, Bot, Tv
} from 'lucide-react';
import axios from 'axios';
import AdminWallet from './AdminWallet';
import RewardedAdsSettings from './RewardedAdsSettings';
import PointsSystemSettings from './PointsSystemSettings';
import ReportsAndNotifications from './ReportsAndNotifications';
import AIModelSettings from './AIModelSettings';
import AdMobSettings from './AdMobSettings';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminSettings = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showKeys, setShowKeys] = useState({});
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Dashboard Stats
  const [dashboardStats, setDashboardStats] = useState(null);
  
  // Payment Gateway Settings
  const [paymentSettings, setPaymentSettings] = useState({
    stripe_enabled: true,
    stripe_api_key: '',
    tap_enabled: false,
    tap_api_key: '',
    tabby_enabled: false,
    tabby_api_key: '',
    tamara_enabled: false,
    tamara_api_key: '',
    stcpay_enabled: false,
    stcpay_api_key: '',
    paypal_enabled: false,
    paypal_client_id: '',
    paypal_secret: '',
    applepay_enabled: false,
    applepay_merchant_id: ''
  });
  
  // OAuth Settings
  const [oauthSettings, setOauthSettings] = useState({
    google_enabled: true,
    google_client_id: '',
    google_client_secret: '',
    apple_enabled: false,
    apple_client_id: '',
    apple_team_id: '',
    apple_key_id: '',
    apple_private_key: ''
  });
  
  // App Settings
  const [appSettings, setAppSettings] = useState({
    maintenance_mode: false,
    maintenance_message: 'التطبيق تحت الصيانة، سنعود قريباً',
    maintenance_message_en: 'App is under maintenance, we\'ll be back soon',
    allow_new_registrations: true,
    allow_withdrawals: true,
    allow_ad_submissions: true,
    min_withdrawal_points: 500,
    points_per_minute: 1,
    ad_price_per_month: 500,
    max_ads_per_10min: 5,
    min_watch_seconds: 30,
    contact_email: '',
    contact_phone: '',
    support_whatsapp: '',
    terms_url: '',
    privacy_url: ''
  });
  
  // Emergency Settings
  const [emergencySettings, setEmergencySettings] = useState({
    pause_all_payments: false,
    pause_all_withdrawals: false,
    block_all_logins: false,
    emergency_message: '',
    show_emergency_banner: false
  });
  
  // Email Settings
  const [emailSettings, setEmailSettings] = useState({
    email_enabled: false,
    resend_api_key: '',
    sender_email: 'onboarding@resend.dev',
    sender_name: 'صقر Saqr',
    send_welcome_email: true,
    send_withdrawal_notifications: true,
    send_ad_notifications: true
  });
  
  const [testEmail, setTestEmail] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('admin_token');
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => {
    loadAllSettings();
  }, []);

  const loadAllSettings = async () => {
    try {
      setIsLoading(true);
      const headers = getAuthHeaders();

      const [paymentRes, oauthRes, appRes, emergencyRes, statsRes, emailRes] = await Promise.all([
        axios.get(`${API}/settings/payment-gateways`, { headers }),
        axios.get(`${API}/settings/oauth`, { headers }),
        axios.get(`${API}/settings/app`, { headers }).catch(() => ({ data: appSettings })),
        axios.get(`${API}/settings/emergency`, { headers }).catch(() => ({ data: emergencySettings })),
        axios.get(`${API}/settings/dashboard/stats`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/email/settings`, { headers }).catch(() => ({ data: emailSettings }))
      ]);

      setPaymentSettings(paymentRes.data);
      setOauthSettings(oauthRes.data);
      setAppSettings({ ...appSettings, ...appRes.data });
      setEmergencySettings({ ...emergencySettings, ...emergencyRes.data });
      setDashboardStats(statsRes.data);
      setEmailSettings({ ...emailSettings, ...emailRes.data });
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (type, data, endpoint) => {
    try {
      setIsSaving(true);
      const headers = getAuthHeaders();
      await axios.put(`${API}/settings/${endpoint}`, data, { headers });
      toast({ title: '✅ تم الحفظ', description: 'تم حفظ الإعدادات بنجاح' });
      loadAllSettings();
    } catch (error) {
      toast({ title: '❌ خطأ', description: 'فشل حفظ الإعدادات', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleMaintenance = async () => {
    try {
      const headers = getAuthHeaders();
      const res = await axios.post(`${API}/settings/maintenance/toggle`, {}, { headers });
      setAppSettings(prev => ({ ...prev, maintenance_mode: res.data.maintenance_mode }));
      toast({
        title: res.data.maintenance_mode ? '🔧 تم تفعيل وضع الصيانة' : '✅ تم إلغاء وضع الصيانة',
        description: res.data.message
      });
    } catch (error) {
      toast({ title: '❌ خطأ', variant: 'destructive' });
    }
  };

  const sendTestEmail = async () => {
    if (!testEmail) {
      toast({ title: '❌ خطأ', description: 'الرجاء إدخال بريد إلكتروني', variant: 'destructive' });
      return;
    }
    
    try {
      setIsSendingTest(true);
      const headers = getAuthHeaders();
      await axios.post(`${API}/email/test`, { to_email: testEmail, email_type: 'welcome' }, { headers });
      toast({ title: '✅ تم الإرسال', description: `تم إرسال البريد التجريبي إلى ${testEmail}` });
      setTestEmail('');
    } catch (error) {
      toast({ 
        title: '❌ خطأ', 
        description: error.response?.data?.detail || 'فشل إرسال البريد التجريبي', 
        variant: 'destructive' 
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const toggleShowKey = (key) => setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div
      className="space-y-4 rounded-lg p-4"
      style={{
        background: '#f8fafc',
        color: '#0f172a',
      }}
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-wrap gap-2 h-auto p-2 bg-white border border-slate-200 rounded-lg mb-4 shadow-sm">
          <TabsTrigger value="dashboard" className="flex items-center gap-1 text-xs text-slate-700 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <TrendingUp className="w-3 h-3" /> لوحة البيانات
          </TabsTrigger>
          <TabsTrigger value="wallet" className="flex items-center gap-1 text-xs text-slate-700 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <Wallet className="w-3 h-3" /> المحفظة
          </TabsTrigger>
          <TabsTrigger value="points" className="flex items-center gap-1 text-xs text-slate-700 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <DollarSign className="w-3 h-3" /> نظام النقاط
          </TabsTrigger>
          <TabsTrigger value="rewarded" className="flex items-center gap-1 text-xs text-slate-700 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <Gift className="w-3 h-3" /> إعلانات المكافآت
          </TabsTrigger>
          <TabsTrigger value="admob" className="flex items-center gap-1 text-xs text-slate-700 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <Tv className="w-3 h-3" /> AdMob
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-1 text-xs text-slate-700 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <Bot className="w-3 h-3" /> الذكاء الاصطناعي
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-1 text-xs text-slate-700 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <FileText className="w-3 h-3" /> التقارير والإشعارات
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="flex items-center gap-1 text-xs text-slate-700 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <Wrench className="w-3 h-3" /> الصيانة
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-1 text-xs text-slate-700 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <CreditCard className="w-3 h-3" /> بوابات الدفع
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-1 text-xs text-slate-700 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <Mail className="w-3 h-3" /> البريد
          </TabsTrigger>
          <TabsTrigger value="auth" className="flex items-center gap-1 text-xs text-slate-700 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <Shield className="w-3 h-3" /> تسجيل الدخول
          </TabsTrigger>
          <TabsTrigger value="app" className="flex items-center gap-1 text-xs text-slate-700 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <Settings className="w-3 h-3" /> إعدادات التطبيق
          </TabsTrigger>
          <TabsTrigger value="emergency" className="flex items-center gap-1 text-xs text-slate-700 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <AlertTriangle className="w-3 h-3" /> الطوارئ
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <CardContent className="pt-4">
                <Users className="w-6 h-6 mb-2 opacity-80" />
                <p className="text-2xl font-bold">{dashboardStats?.users?.total || 0}</p>
                <p className="text-xs opacity-80">إجمالي المستخدمين</p>
                <p className="text-xs mt-1">+{dashboardStats?.users?.new_today || 0} اليوم</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
              <CardContent className="pt-4">
                <DollarSign className="w-6 h-6 mb-2 opacity-80" />
                <p className="text-2xl font-bold">{dashboardStats?.financials?.total_revenue || 0}</p>
                <p className="text-xs opacity-80">الإيرادات (ر.س)</p>
                <p className="text-xs mt-1">صافي: {dashboardStats?.financials?.net_profit || 0}</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <CardContent className="pt-4">
                <Activity className="w-6 h-6 mb-2 opacity-80" />
                <p className="text-2xl font-bold">{dashboardStats?.ads?.active || 0}</p>
                <p className="text-xs opacity-80">إعلانات نشطة</p>
                <p className="text-xs mt-1">{dashboardStats?.ads?.pending || 0} معلقة</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
              <CardContent className="pt-4">
                <Clock className="w-6 h-6 mb-2 opacity-80" />
                <p className="text-2xl font-bold">{dashboardStats?.withdrawals?.pending || 0}</p>
                <p className="text-xs opacity-80">طلبات سحب معلقة</p>
                <p className="text-xs mt-1">{dashboardStats?.withdrawals?.approved || 0} مكتملة</p>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>ملخص سريع</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">إجمالي النقاط الموزعة</p>
                  <p className="text-xl font-bold text-indigo-600">{dashboardStats?.financials?.total_points_distributed || 0}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">المدفوعات للمستخدمين</p>
                  <p className="text-xl font-bold text-red-600">${dashboardStats?.financials?.total_payouts || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Wallet Tab */}
        <TabsContent value="wallet">
          <AdminWallet />
        </TabsContent>

        {/* Maintenance Tab */}
        <TabsContent value="maintenance">
          <Card className={appSettings.maintenance_mode ? 'border-2 border-orange-500' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                وضع الصيانة
              </CardTitle>
              <CardDescription>
                عند تفعيل وضع الصيانة، سيرى المستخدمون رسالة الصيانة ولن يتمكنوا من استخدام التطبيق
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`p-6 rounded-lg text-center ${appSettings.maintenance_mode ? 'bg-orange-100' : 'bg-gray-100'}`}>
                <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${appSettings.maintenance_mode ? 'bg-orange-500' : 'bg-gray-400'}`}>
                  <Power className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2">
                  {appSettings.maintenance_mode ? '🔧 وضع الصيانة مفعّل' : '✅ التطبيق يعمل بشكل طبيعي'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {appSettings.maintenance_mode ? 'المستخدمون لا يمكنهم الوصول للتطبيق حالياً' : 'جميع الخدمات تعمل بشكل طبيعي'}
                </p>
                <Button
                  onClick={toggleMaintenance}
                  className={appSettings.maintenance_mode ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}
                  size="lg"
                >
                  {appSettings.maintenance_mode ? '✅ إلغاء وضع الصيانة' : '🔧 تفعيل وضع الصيانة'}
                </Button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label>رسالة الصيانة (عربي)</Label>
                  <Input
                    value={appSettings.maintenance_message}
                    onChange={(e) => setAppSettings(prev => ({ ...prev, maintenance_message: e.target.value }))}
                    placeholder="التطبيق تحت الصيانة..."
                  />
                </div>
                <div>
                  <Label>Maintenance Message (English)</Label>
                  <Input
                    value={appSettings.maintenance_message_en}
                    onChange={(e) => setAppSettings(prev => ({ ...prev, maintenance_message_en: e.target.value }))}
                    placeholder="App is under maintenance..."
                    dir="ltr"
                  />
                </div>
                <Button onClick={() => saveSettings('app', appSettings, 'app')} disabled={isSaving}>
                  <Save className="w-4 h-4 ml-2" /> حفظ رسالة الصيانة
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rewarded Ads Tab */}
        <TabsContent value="rewarded">
          <RewardedAdsSettings />
        </TabsContent>

        {/* AdMob Tab */}
        <TabsContent value="admob">
          <AdMobSettings adminToken={localStorage.getItem('admin_token')} />
        </TabsContent>

        {/* Points System Tab */}
        <TabsContent value="points">
          <PointsSystemSettings />
        </TabsContent>

        {/* AI Models Tab */}
        <TabsContent value="ai">
          <AIModelSettings adminToken={localStorage.getItem('admin_token')} />
        </TabsContent>

        {/* Reports and Notifications Tab */}
        <TabsContent value="reports">
          <ReportsAndNotifications adminToken={localStorage.getItem('admin_token')} />
        </TabsContent>

        {/* Payment Gateways Tab */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" /> بوابات الدفع
              </CardTitle>
              <CardDescription>إدارة مفاتيح API لبوابات الدفع المختلفة</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { id: 'stripe', name: 'Stripe (عالمي)', color: 'indigo' },
                  { id: 'tap', name: 'Tap (محلي)', color: 'green' },
                  { id: 'tabby', name: 'Tabby', color: 'blue' },
                  { id: 'tamara', name: 'Tamara', color: 'purple' },
                  { id: 'stcpay', name: 'STC Pay', color: 'violet' }
                ].map(gateway => (
                  <div key={gateway.id} className={`p-4 rounded-lg border-2 ${paymentSettings[`${gateway.id}_enabled`] ? `border-${gateway.color}-200 bg-${gateway.color}-50` : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold">{gateway.name}</span>
                      <Switch
                        checked={paymentSettings[`${gateway.id}_enabled`]}
                        onCheckedChange={(checked) => setPaymentSettings(prev => ({ ...prev, [`${gateway.id}_enabled`]: checked }))}
                      />
                    </div>
                    {paymentSettings[`${gateway.id}_enabled`] && (
                      <div className="relative">
                        <Input
                          type={showKeys[gateway.id] ? 'text' : 'password'}
                          value={paymentSettings[`${gateway.id}_api_key`]}
                          onChange={(e) => setPaymentSettings(prev => ({ ...prev, [`${gateway.id}_api_key`]: e.target.value }))}
                          placeholder="مفتاح API"
                          className="pl-10"
                        />
                        <button onClick={() => toggleShowKey(gateway.id)} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                          {showKeys[gateway.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                
                {/* PayPal Special */}
                <div className={`p-4 rounded-lg border-2 ${paymentSettings.paypal_enabled ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold">PayPal</span>
                    <Switch
                      checked={paymentSettings.paypal_enabled}
                      onCheckedChange={(checked) => setPaymentSettings(prev => ({ ...prev, paypal_enabled: checked }))}
                    />
                  </div>
                  {paymentSettings.paypal_enabled && (
                    <div className="space-y-2">
                      <Input
                        type={showKeys['paypal_id'] ? 'text' : 'password'}
                        value={paymentSettings.paypal_client_id}
                        onChange={(e) => setPaymentSettings(prev => ({ ...prev, paypal_client_id: e.target.value }))}
                        placeholder="Client ID"
                      />
                      <Input
                        type={showKeys['paypal_secret'] ? 'text' : 'password'}
                        value={paymentSettings.paypal_secret}
                        onChange={(e) => setPaymentSettings(prev => ({ ...prev, paypal_secret: e.target.value }))}
                        placeholder="Secret"
                      />
                    </div>
                  )}
                </div>
                
                {/* Apple Pay */}
                <div className={`p-4 rounded-lg border-2 ${paymentSettings.applepay_enabled ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`font-semibold ${paymentSettings.applepay_enabled ? 'text-white' : ''}`}> Apple Pay</span>
                    <Switch
                      checked={paymentSettings.applepay_enabled}
                      onCheckedChange={(checked) => setPaymentSettings(prev => ({ ...prev, applepay_enabled: checked }))}
                    />
                  </div>
                  {paymentSettings.applepay_enabled && (
                    <div className="space-y-3">
                      <div className={`p-3 rounded-lg ${paymentSettings.stripe_enabled ? 'bg-green-900/50 border border-green-600' : 'bg-red-900/50 border border-red-600'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          {paymentSettings.stripe_enabled ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400" />
                          )}
                          <span className="text-sm text-white font-medium">
                            {paymentSettings.stripe_enabled ? 'Stripe مفعّل ✓' : 'Stripe غير مفعّل!'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-300">
                          {paymentSettings.stripe_enabled 
                            ? 'Apple Pay يعمل تلقائياً عبر Stripe. سيظهر للمستخدمين على أجهزة Apple المتوافقة.'
                            : 'Apple Pay يتطلب تفعيل Stripe أولاً. قم بتفعيل Stripe وإدخال مفتاح API.'}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-gray-400">Merchant ID (اختياري)</label>
                        <Input
                          type={showKeys['applepay'] ? 'text' : 'password'}
                          value={paymentSettings.applepay_merchant_id}
                          onChange={(e) => setPaymentSettings(prev => ({ ...prev, applepay_merchant_id: e.target.value }))}
                          placeholder="merchant.com.yourapp (اختياري)"
                          className="bg-gray-800 border-gray-700 text-white placeholder-gray-400"
                        />
                      </div>
                      <div className="p-2 bg-gray-800 rounded-lg text-xs text-gray-400">
                        <p className="font-medium text-gray-300 mb-1">💡 كيف يعمل Apple Pay؟</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>عند الدفع عبر Stripe Checkout من iPhone/iPad/Mac</li>
                          <li>يظهر زر Apple Pay تلقائياً للمستخدم</li>
                          <li>لا حاجة لإعداد إضافي - Stripe يتكفل بالباقي</li>
                          <li>فعّل Apple Pay في لوحة Stripe: Settings → Payment Methods</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <Button onClick={() => saveSettings('payments', paymentSettings, 'payment-gateways')} disabled={isSaving} className="w-full">
                <Save className="w-4 h-4 ml-2" /> حفظ إعدادات الدفع
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Settings Tab */}
        <TabsContent value="email">
          <div className="space-y-4">
            <Card className={emailSettings.email_enabled ? 'border-2 border-green-200' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="w-5 h-5" /> خدمة البريد الإلكتروني
                  </CardTitle>
                  <Switch
                    checked={emailSettings.email_enabled}
                    onCheckedChange={(checked) => setEmailSettings(prev => ({ ...prev, email_enabled: checked }))}
                  />
                </div>
                <CardDescription>
                  إرسال إشعارات البريد الإلكتروني للمستخدمين. 
                  <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline mr-1">احصل على مفتاح API من Resend</a>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>مفتاح Resend API</Label>
                  <div className="relative">
                    <Input
                      type={showKeys['resend'] ? 'text' : 'password'}
                      value={emailSettings.resend_api_key}
                      onChange={(e) => setEmailSettings(prev => ({ ...prev, resend_api_key: e.target.value }))}
                      placeholder="re_xxxxxxxx..."
                      dir="ltr"
                      className="pl-10"
                    />
                    <button onClick={() => toggleShowKey('resend')} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showKeys['resend'] ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>اسم المرسل</Label>
                    <Input
                      value={emailSettings.sender_name}
                      onChange={(e) => setEmailSettings(prev => ({ ...prev, sender_name: e.target.value }))}
                      placeholder="صقر Saqr"
                    />
                  </div>
                  <div>
                    <Label>بريد المرسل</Label>
                    <Input
                      type="email"
                      value={emailSettings.sender_email}
                      onChange={(e) => setEmailSettings(prev => ({ ...prev, sender_email: e.target.value }))}
                      placeholder="noreply@yourdomain.com"
                      dir="ltr"
                    />
                    <p className="text-xs text-gray-500 mt-1">استخدم onboarding@resend.dev للاختبار</p>
                  </div>
                </div>
                
                <div className="space-y-3 pt-4 border-t">
                  <Label className="text-base font-semibold">أنواع الإشعارات</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className={`flex items-center justify-between p-3 rounded-lg ${emailSettings.send_welcome_email ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                      <div className="flex items-center gap-2">
                        <CheckCircle className={`w-4 h-4 ${emailSettings.send_welcome_email ? 'text-green-600' : 'text-gray-400'}`} />
                        <span className="text-sm">ترحيب المستخدمين</span>
                      </div>
                      <Switch
                        checked={emailSettings.send_welcome_email}
                        onCheckedChange={(checked) => setEmailSettings(prev => ({ ...prev, send_welcome_email: checked }))}
                      />
                    </div>
                    <div className={`flex items-center justify-between p-3 rounded-lg ${emailSettings.send_withdrawal_notifications ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                      <div className="flex items-center gap-2">
                        <DollarSign className={`w-4 h-4 ${emailSettings.send_withdrawal_notifications ? 'text-green-600' : 'text-gray-400'}`} />
                        <span className="text-sm">إشعارات السحب</span>
                      </div>
                      <Switch
                        checked={emailSettings.send_withdrawal_notifications}
                        onCheckedChange={(checked) => setEmailSettings(prev => ({ ...prev, send_withdrawal_notifications: checked }))}
                      />
                    </div>
                    <div className={`flex items-center justify-between p-3 rounded-lg ${emailSettings.send_ad_notifications ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                      <div className="flex items-center gap-2">
                        <Activity className={`w-4 h-4 ${emailSettings.send_ad_notifications ? 'text-green-600' : 'text-gray-400'}`} />
                        <span className="text-sm">إشعارات الإعلانات</span>
                      </div>
                      <Switch
                        checked={emailSettings.send_ad_notifications}
                        onCheckedChange={(checked) => setEmailSettings(prev => ({ ...prev, send_ad_notifications: checked }))}
                      />
                    </div>
                  </div>
                </div>
                
                <Button onClick={() => saveSettings('email', emailSettings, 'email/settings')} disabled={isSaving} className="w-full">
                  <Save className="w-4 h-4 ml-2" /> حفظ إعدادات البريد
                </Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="w-5 h-5" /> إرسال بريد تجريبي
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="أدخل بريدك الإلكتروني..."
                    dir="ltr"
                    className="flex-1"
                  />
                  <Button 
                    onClick={sendTestEmail} 
                    disabled={isSendingTest || !emailSettings.email_enabled}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {isSendingTest ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 ml-2" /> إرسال</>}
                  </Button>
                </div>
                {!emailSettings.email_enabled && (
                  <p className="text-xs text-orange-600 mt-2">⚠️ يجب تفعيل خدمة البريد أولاً</p>
                )}
              </CardContent>
            </Card>
            
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-4">
                <h4 className="font-semibold text-blue-800 mb-2">💡 كيفية إعداد Resend:</h4>
                <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
                  <li>أنشئ حساب مجاني على <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="underline">resend.com</a></li>
                  <li>اذهب إلى API Keys واضغط على Create API Key</li>
                  <li>انسخ المفتاح (يبدأ بـ re_) والصقه هنا</li>
                </ol>
                <p className="text-xs text-blue-600 mt-2">✨ المستوى المجاني: 3000 رسالة/شهر</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Auth Tab */}
        <TabsContent value="auth">
          <div className="space-y-4">
            {/* Google OAuth */}
            <Card className={oauthSettings.google_enabled ? 'border-2 border-red-200' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Google OAuth
                  </CardTitle>
                  <Switch
                    checked={oauthSettings.google_enabled}
                    onCheckedChange={(checked) => setOauthSettings(prev => ({ ...prev, google_enabled: checked }))}
                  />
                </div>
                <CardDescription>
                  احصل على المفاتيح من: <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Google Cloud Console</a>
                </CardDescription>
              </CardHeader>
              {oauthSettings.google_enabled && (
                <CardContent className="space-y-3">
                  <div>
                    <Label>Client ID</Label>
                    <div className="relative">
                      <Input
                        type={showKeys['google_client_id'] ? 'text' : 'password'}
                        value={oauthSettings.google_client_id}
                        onChange={(e) => setOauthSettings(prev => ({ ...prev, google_client_id: e.target.value }))}
                        placeholder="xxxx.apps.googleusercontent.com"
                        dir="ltr"
                        className="pl-10"
                      />
                      <button onClick={() => toggleShowKey('google_client_id')} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        {showKeys['google_client_id'] ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label>Client Secret</Label>
                    <div className="relative">
                      <Input
                        type={showKeys['google_client_secret'] ? 'text' : 'password'}
                        value={oauthSettings.google_client_secret}
                        onChange={(e) => setOauthSettings(prev => ({ ...prev, google_client_secret: e.target.value }))}
                        placeholder="GOCSPX-xxxxx"
                        dir="ltr"
                        className="pl-10"
                      />
                      <button onClick={() => toggleShowKey('google_client_secret')} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        {showKeys['google_client_secret'] ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-lg text-sm">
                    <p className="font-medium text-yellow-800">💡 إعداد Google OAuth:</p>
                    <ol className="list-decimal list-inside text-yellow-700 mt-1 space-y-1 text-xs">
                      <li>اذهب إلى Google Cloud Console</li>
                      <li>أنشئ مشروع جديد أو اختر مشروع موجود</li>
                      <li>فعّل Google+ API</li>
                      <li>أنشئ OAuth 2.0 Client ID</li>
                      <li>أضف Authorized redirect URI</li>
                    </ol>
                  </div>
                </CardContent>
              )}
            </Card>
            
            {/* Apple OAuth */}
            <Card className={oauthSettings.apple_enabled ? 'border-2 border-gray-800' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                    Apple Sign In
                  </CardTitle>
                  <Switch
                    checked={oauthSettings.apple_enabled}
                    onCheckedChange={(checked) => setOauthSettings(prev => ({ ...prev, apple_enabled: checked }))}
                  />
                </div>
                <CardDescription>
                  احصل على المفاتيح من: <a href="https://developer.apple.com/account/resources/identifiers/list/serviceId" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Apple Developer Portal</a>
                </CardDescription>
              </CardHeader>
              {oauthSettings.apple_enabled && (
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Service ID (Client ID)</Label>
                      <Input
                        type={showKeys['apple_client_id'] ? 'text' : 'password'}
                        value={oauthSettings.apple_client_id}
                        onChange={(e) => setOauthSettings(prev => ({ ...prev, apple_client_id: e.target.value }))}
                        placeholder="com.yourapp.service"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <Label>Team ID</Label>
                      <Input
                        type={showKeys['apple_team_id'] ? 'text' : 'password'}
                        value={oauthSettings.apple_team_id}
                        onChange={(e) => setOauthSettings(prev => ({ ...prev, apple_team_id: e.target.value }))}
                        placeholder="XXXXXXXXXX"
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Key ID</Label>
                    <Input
                      type={showKeys['apple_key_id'] ? 'text' : 'password'}
                      value={oauthSettings.apple_key_id}
                      onChange={(e) => setOauthSettings(prev => ({ ...prev, apple_key_id: e.target.value }))}
                      placeholder="XXXXXXXXXX"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <Label>Private Key (.p8)</Label>
                    <textarea
                      value={oauthSettings.apple_private_key}
                      onChange={(e) => setOauthSettings(prev => ({ ...prev, apple_private_key: e.target.value }))}
                      placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                      className="w-full h-24 p-2 border rounded-md text-xs font-mono"
                      dir="ltr"
                    />
                  </div>
                  <div className="p-3 bg-gray-100 rounded-lg text-sm">
                    <p className="font-medium text-gray-800">💡 إعداد Apple Sign In:</p>
                    <ol className="list-decimal list-inside text-gray-600 mt-1 space-y-1 text-xs">
                      <li>اذهب إلى Apple Developer Portal</li>
                      <li>أنشئ App ID مع Sign In with Apple</li>
                      <li>أنشئ Service ID للويب</li>
                      <li>أنشئ Key للمصادقة</li>
                      <li>حمّل ملف .p8 وانسخ المحتوى هنا</li>
                    </ol>
                  </div>
                </CardContent>
              )}
            </Card>
            
            <Button onClick={() => saveSettings('oauth', oauthSettings, 'oauth')} disabled={isSaving} className="w-full">
              <Save className="w-4 h-4 ml-2" /> حفظ إعدادات تسجيل الدخول
            </Button>
          </div>
        </TabsContent>

        {/* App Settings Tab */}
        <TabsContent value="app">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>التحكم في الميزات</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span>السماح بالتسجيل الجديد</span>
                    <Switch
                      checked={appSettings.allow_new_registrations}
                      onCheckedChange={(checked) => setAppSettings(prev => ({ ...prev, allow_new_registrations: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span>السماح بالسحوبات</span>
                    <Switch
                      checked={appSettings.allow_withdrawals}
                      onCheckedChange={(checked) => setAppSettings(prev => ({ ...prev, allow_withdrawals: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span>السماح بإضافة إعلانات</span>
                    <Switch
                      checked={appSettings.allow_ad_submissions}
                      onCheckedChange={(checked) => setAppSettings(prev => ({ ...prev, allow_ad_submissions: checked }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>إعدادات النقاط والأسعار</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label>الحد الأدنى للسحب (نقطة)</Label>
                    <Input
                      type="number"
                      value={appSettings.min_withdrawal_points}
                      onChange={(e) => setAppSettings(prev => ({ ...prev, min_withdrawal_points: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label>نقاط لكل دقيقة</Label>
                    <Input
                      type="number"
                      value={appSettings.points_per_minute}
                      onChange={(e) => setAppSettings(prev => ({ ...prev, points_per_minute: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label>سعر الإعلان الشهري (ر.س)</Label>
                    <Input
                      type="number"
                      value={appSettings.ad_price_per_month}
                      onChange={(e) => setAppSettings(prev => ({ ...prev, ad_price_per_month: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label>أقصى إعلانات/10 دقائق</Label>
                    <Input
                      type="number"
                      value={appSettings.max_ads_per_10min}
                      onChange={(e) => setAppSettings(prev => ({ ...prev, max_ads_per_10min: parseInt(e.target.value) }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>معلومات التواصل</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="flex items-center gap-1"><Mail className="w-3 h-3" /> البريد الإلكتروني</Label>
                    <Input
                      value={appSettings.contact_email}
                      onChange={(e) => setAppSettings(prev => ({ ...prev, contact_email: e.target.value }))}
                      placeholder="support@saqr.app"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1"><Phone className="w-3 h-3" /> رقم الهاتف</Label>
                    <Input
                      value={appSettings.contact_phone}
                      onChange={(e) => setAppSettings(prev => ({ ...prev, contact_phone: e.target.value }))}
                      placeholder="+966..."
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> WhatsApp</Label>
                    <Input
                      value={appSettings.support_whatsapp}
                      onChange={(e) => setAppSettings(prev => ({ ...prev, support_whatsapp: e.target.value }))}
                      placeholder="+966..."
                      dir="ltr"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <Label className="flex items-center gap-1"><Link className="w-3 h-3" /> رابط الشروط والأحكام</Label>
                    <Input
                      value={appSettings.terms_url}
                      onChange={(e) => setAppSettings(prev => ({ ...prev, terms_url: e.target.value }))}
                      placeholder="https://..."
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1"><Link className="w-3 h-3" /> رابط سياسة الخصوصية</Label>
                    <Input
                      value={appSettings.privacy_url}
                      onChange={(e) => setAppSettings(prev => ({ ...prev, privacy_url: e.target.value }))}
                      placeholder="https://..."
                      dir="ltr"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Button onClick={() => saveSettings('app', appSettings, 'app')} disabled={isSaving} className="w-full">
              <Save className="w-4 h-4 ml-2" /> حفظ إعدادات التطبيق
            </Button>
          </div>
        </TabsContent>

        {/* Emergency Tab */}
        <TabsContent value="emergency">
          <Card className="border-2 border-red-200">
            <CardHeader className="bg-red-50">
              <CardTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="w-5 h-5" /> خيارات الطوارئ
              </CardTitle>
              <CardDescription className="text-red-600">
                استخدم هذه الخيارات فقط في حالات الطوارئ - ستؤثر على جميع المستخدمين فوراً
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`p-4 rounded-lg border-2 ${emergencySettings.pause_all_payments ? 'border-red-500 bg-red-100' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Ban className="w-5 h-5 text-red-600" />
                      <span className="font-medium">إيقاف جميع المدفوعات</span>
                    </div>
                    <Switch
                      checked={emergencySettings.pause_all_payments}
                      onCheckedChange={(checked) => setEmergencySettings(prev => ({ ...prev, pause_all_payments: checked }))}
                    />
                  </div>
                </div>
                
                <div className={`p-4 rounded-lg border-2 ${emergencySettings.pause_all_withdrawals ? 'border-red-500 bg-red-100' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Ban className="w-5 h-5 text-red-600" />
                      <span className="font-medium">إيقاف جميع السحوبات</span>
                    </div>
                    <Switch
                      checked={emergencySettings.pause_all_withdrawals}
                      onCheckedChange={(checked) => setEmergencySettings(prev => ({ ...prev, pause_all_withdrawals: checked }))}
                    />
                  </div>
                </div>
                
                <div className={`p-4 rounded-lg border-2 ${emergencySettings.block_all_logins ? 'border-red-500 bg-red-100' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Ban className="w-5 h-5 text-red-600" />
                      <span className="font-medium">منع تسجيل الدخول</span>
                    </div>
                    <Switch
                      checked={emergencySettings.block_all_logins}
                      onCheckedChange={(checked) => setEmergencySettings(prev => ({ ...prev, block_all_logins: checked }))}
                    />
                  </div>
                </div>
              </div>
              
              <div className={`p-4 rounded-lg border-2 ${emergencySettings.show_emergency_banner ? 'border-orange-500 bg-orange-100' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-orange-600" />
                    <span className="font-medium">عرض رسالة طوارئ للمستخدمين</span>
                  </div>
                  <Switch
                    checked={emergencySettings.show_emergency_banner}
                    onCheckedChange={(checked) => setEmergencySettings(prev => ({ ...prev, show_emergency_banner: checked }))}
                  />
                </div>
                {emergencySettings.show_emergency_banner && (
                  <Input
                    value={emergencySettings.emergency_message}
                    onChange={(e) => setEmergencySettings(prev => ({ ...prev, emergency_message: e.target.value }))}
                    placeholder="اكتب رسالة الطوارئ هنا..."
                    className="mt-2"
                  />
                )}
              </div>
              
              <Button 
                onClick={() => saveSettings('emergency', emergencySettings, 'emergency')} 
                disabled={isSaving} 
                className="w-full bg-red-600 hover:bg-red-700"
              >
                <Save className="w-4 h-4 ml-2" /> حفظ إعدادات الطوارئ
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSettings;
