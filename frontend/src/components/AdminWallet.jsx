import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from '../hooks/use-toast';
import { 
  Wallet, Plus, ArrowDownCircle, ArrowUpCircle, CreditCard, 
  Building2, RefreshCw, AlertTriangle, Clock, Trash2,
  DollarSign, History
} from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminWallet = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [walletData, setWalletData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [walletSettings, setWalletSettings] = useState({
    bank_account: null,
    paypal: null,
    low_balance_alert: 1000
  });
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Bank account form
  const [bankForm, setBankForm] = useState({
    bank_name: '',
    account_holder: '',
    account_number: '',
    iban: '',
    swift_code: ''
  });

  const [paypalEmail, setPaypalEmail] = useState('');

  const getAuthHeaders = () => {
    const token = localStorage.getItem('admin_token');
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => {
    loadWalletData();
    
    // Check for deposit success in URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('deposit') === 'success') {
      const sessionId = params.get('session_id');
      if (sessionId) {
        confirmStripeDeposit(sessionId);
      }
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const loadWalletData = async () => {
    try {
      setIsLoading(true);
      const headers = getAuthHeaders();

      const [balanceRes, transactionsRes, settingsRes] = await Promise.all([
        axios.get(`${API}/wallet/balance`, { headers }),
        axios.get(`${API}/wallet/transactions`, { headers }),
        axios.get(`${API}/wallet/settings`, { headers })
      ]);

      setWalletData(balanceRes.data);
      setTransactions(transactionsRes.data.transactions || []);
      setWalletSettings(settingsRes.data);
      
      if (settingsRes.data.bank_account) {
        setBankForm(settingsRes.data.bank_account);
      }
      if (settingsRes.data.paypal) {
        setPaypalEmail(settingsRes.data.paypal.email);
      }
    } catch (error) {
      console.error('Failed to load wallet data:', error);
      toast({ title: '❌ خطأ', description: 'فشل تحميل بيانات المحفظة', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const confirmStripeDeposit = async (sessionId) => {
    try {
      const headers = getAuthHeaders();
      const res = await axios.post(`${API}/wallet/deposit/stripe/confirm?session_id=${sessionId}`, {}, { headers });
      
      if (!res.data.already_processed) {
        toast({ title: '✅ تم الإيداع', description: res.data.message });
      }
      loadWalletData();
    } catch (error) {
      console.error('Failed to confirm deposit:', error);
    }
  };

  const handleStripeDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) < 100) {
      toast({ title: '⚠️ تنبيه', description: 'الحد الأدنى للإيداع 100 ريال', variant: 'destructive' });
      return;
    }

    try {
      setIsProcessing(true);
      const headers = getAuthHeaders();
      
      const res = await axios.post(`${API}/wallet/deposit/stripe`, {
        amount: parseFloat(depositAmount),
        payment_method: 'stripe',
        currency: 'SAR'
      }, { headers });

      // Redirect to Stripe checkout
      window.location.href = res.data.checkout_url;
    } catch (error) {
      toast({ title: '❌ خطأ', description: error.response?.data?.detail || 'فشل إنشاء جلسة الدفع', variant: 'destructive' });
      setIsProcessing(false);
    }
  };

  const deleteTransaction = async (transactionId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المعاملة؟ سيتم عكس تأثيرها على الرصيد.')) {
      return;
    }

    try {
      const headers = getAuthHeaders();
      await axios.delete(`${API}/wallet/transactions/${transactionId}`, { headers });
      toast({ title: '✅ تم الحذف', description: 'تم حذف المعاملة بنجاح' });
      loadWalletData();
    } catch (error) {
      toast({ title: '❌ خطأ', description: error.response?.data?.detail || 'فشل حذف المعاملة', variant: 'destructive' });
    }
  };

  const resetWallet = async () => {
    if (!window.confirm('⚠️ تحذير: سيتم حذف جميع المعاملات وإعادة الرصيد إلى صفر. هل أنت متأكد؟')) {
      return;
    }

    try {
      const headers = getAuthHeaders();
      await axios.delete(`${API}/wallet/reset`, { headers });
      toast({ title: '✅ تم', description: 'تم إعادة تعيين المحفظة' });
      loadWalletData();
    } catch (error) {
      toast({ title: '❌ خطأ', description: 'فشل إعادة التعيين', variant: 'destructive' });
    }
  };

  const saveWalletSettings = async () => {
    try {
      setIsProcessing(true);
      const headers = getAuthHeaders();
      
      const settingsData = {
        low_balance_alert: walletSettings.low_balance_alert,
        auto_notify_on_low: true
      };

      if (bankForm.bank_name && bankForm.account_number) {
        settingsData.bank_account = bankForm;
      }

      if (paypalEmail) {
        settingsData.paypal = { email: paypalEmail };
      }

      await axios.put(`${API}/wallet/settings`, settingsData, { headers });

      toast({ title: '✅ تم الحفظ', description: 'تم حفظ إعدادات المحفظة' });
      setShowSettingsModal(false);
      loadWalletData();
    } catch (error) {
      toast({ title: '❌ خطأ', description: 'فشل حفظ الإعدادات', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Balance Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className={`${walletData?.is_low_balance ? 'bg-red-50 border-red-200' : 'bg-gradient-to-br from-green-500 to-green-600'} ${walletData?.is_low_balance ? 'text-red-800' : 'text-white'}`}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <Wallet className={`w-6 h-6 ${walletData?.is_low_balance ? 'text-red-600' : 'opacity-80'}`} />
              {walletData?.is_low_balance && <AlertTriangle className="w-5 h-5 text-red-600" />}
            </div>
            <p className="text-3xl font-bold">{walletData?.balance?.toLocaleString() || 0}</p>
            <p className="text-sm opacity-80">الرصيد الحالي (ر.س)</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="pt-4">
            <ArrowDownCircle className="w-6 h-6 mb-2 opacity-80" />
            <p className="text-2xl font-bold">{walletData?.total_deposited?.toLocaleString() || 0}</p>
            <p className="text-xs opacity-80">إجمالي الإيداعات</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <CardContent className="pt-4">
            <ArrowUpCircle className="w-6 h-6 mb-2 opacity-80" />
            <p className="text-2xl font-bold">{walletData?.total_withdrawn?.toLocaleString() || 0}</p>
            <p className="text-xs opacity-80">إجمالي المدفوعات</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="pt-4">
            <Clock className="w-6 h-6 mb-2 opacity-80" />
            <p className="text-2xl font-bold">{walletData?.pending_withdrawals?.toLocaleString() || 0}</p>
            <p className="text-xs opacity-80">سحوبات معلقة</p>
          </CardContent>
        </Card>
      </div>

      {/* Low Balance Alert */}
      {walletData?.is_low_balance && (
        <Card className="border-2 border-red-300 bg-red-50">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <div>
                <p className="font-semibold text-red-800">⚠️ تنبيه: الرصيد منخفض!</p>
                <p className="text-sm text-red-600">
                  الرصيد الحالي ({walletData.balance} ر.س) أقل من الحد الأدنى ({walletData.low_balance_alert} ر.س). 
                  يرجى إيداع رصيد لتتمكن من معالجة طلبات السحب.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 flex-wrap">
        <Button onClick={() => setShowDepositModal(true)} className="bg-green-600 hover:bg-green-700">
          <Plus className="w-4 h-4 ml-2" /> إيداع رصيد (Stripe)
        </Button>
        <Button onClick={() => setShowSettingsModal(true)} variant="outline">
          <Building2 className="w-4 h-4 ml-2" /> إعدادات الحساب البنكي
        </Button>
        <Button onClick={loadWalletData} variant="ghost">
          <RefreshCw className="w-4 h-4" />
        </Button>
        {transactions.length > 0 && (
          <Button onClick={resetWallet} variant="destructive" size="sm">
            <Trash2 className="w-4 h-4 ml-2" /> مسح السجل
          </Button>
        )}
      </div>

      {/* Deposit Modal - Stripe Only */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-600" />
                إيداع رصيد عبر Stripe
              </CardTitle>
              <CardDescription>ادفع ببطاقة الائتمان أو الخصم لإيداع رصيد حقيقي في المحفظة</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>المبلغ (ريال سعودي)</Label>
                <Input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="1000"
                  min="100"
                  className="text-lg"
                />
                <p className="text-xs text-gray-500 mt-1">الحد الأدنى: 100 ريال</p>
              </div>

              <div className="p-4 bg-indigo-50 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <CreditCard className="w-8 h-8 text-indigo-600" />
                  <div>
                    <p className="font-semibold text-indigo-800">Stripe Checkout</p>
                    <p className="text-xs text-indigo-600">دفع آمن ببطاقة الائتمان</p>
                  </div>
                </div>
                <p className="text-xs text-indigo-700">
                  سيتم توجيهك إلى صفحة Stripe الآمنة لإتمام الدفع
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={handleStripeDeposit}
                  disabled={isProcessing || !depositAmount}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                >
                  {isProcessing ? (
                    <RefreshCw className="w-4 h-4 animate-spin ml-2" />
                  ) : (
                    <CreditCard className="w-4 h-4 ml-2" />
                  )}
                  الدفع الآن
                </Button>
                <Button onClick={() => setShowDepositModal(false)} variant="outline">
                  إلغاء
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <Card className="w-full max-w-lg my-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                إعدادات الحساب المالي
              </CardTitle>
              <CardDescription>أضف حسابك البنكي أو PayPal لاستقبال الأموال</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Bank Account */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Building2 className="w-4 h-4" /> الحساب البنكي
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>اسم البنك</Label>
                    <Input
                      value={bankForm.bank_name}
                      onChange={(e) => setBankForm({...bankForm, bank_name: e.target.value})}
                      placeholder="مثال: الراجحي"
                    />
                  </div>
                  <div>
                    <Label>اسم صاحب الحساب</Label>
                    <Input
                      value={bankForm.account_holder}
                      onChange={(e) => setBankForm({...bankForm, account_holder: e.target.value})}
                      placeholder="الاسم كما في البنك"
                    />
                  </div>
                </div>
                <div>
                  <Label>رقم الحساب</Label>
                  <Input
                    value={bankForm.account_number}
                    onChange={(e) => setBankForm({...bankForm, account_number: e.target.value})}
                    placeholder="رقم الحساب البنكي"
                    dir="ltr"
                  />
                </div>
                <div>
                  <Label>رقم الآيبان (IBAN)</Label>
                  <Input
                    value={bankForm.iban}
                    onChange={(e) => setBankForm({...bankForm, iban: e.target.value})}
                    placeholder="SA..."
                    dir="ltr"
                  />
                </div>
                <div>
                  <Label>رمز السويفت (اختياري)</Label>
                  <Input
                    value={bankForm.swift_code}
                    onChange={(e) => setBankForm({...bankForm, swift_code: e.target.value})}
                    placeholder="SWIFT Code"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* PayPal */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <DollarSign className="w-4 h-4" /> PayPal
                </h3>
                <div>
                  <Label>بريد PayPal الإلكتروني</Label>
                  <Input
                    type="email"
                    value={paypalEmail}
                    onChange={(e) => setPaypalEmail(e.target.value)}
                    placeholder="your@email.com"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Alert Settings */}
              <div className="space-y-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> تنبيه الرصيد المنخفض
                </h3>
                <div>
                  <Label>تنبيه عند وصول الرصيد إلى (ر.س)</Label>
                  <Input
                    type="number"
                    value={walletSettings.low_balance_alert}
                    onChange={(e) => setWalletSettings({...walletSettings, low_balance_alert: parseInt(e.target.value)})}
                    placeholder="1000"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={saveWalletSettings} disabled={isProcessing} className="flex-1">
                  {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin ml-2" /> : null}
                  حفظ الإعدادات
                </Button>
                <Button onClick={() => setShowSettingsModal(false)} variant="outline">
                  إلغاء
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Transactions History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            سجل المعاملات
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>لا توجد معاملات بعد</p>
              <p className="text-sm mt-1">قم بإيداع رصيد لبدء استخدام المحفظة</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {transactions.map((tx, index) => (
                <div key={tx.id || index} className={`flex items-center justify-between p-3 rounded-lg ${tx.type === 'deposit' ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="flex items-center gap-3">
                    {tx.type === 'deposit' ? (
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <ArrowDownCircle className="w-5 h-5 text-green-600" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                        <ArrowUpCircle className="w-5 h-5 text-red-600" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium">
                        {tx.type === 'deposit' ? 'إيداع' : 'سحب'} - {tx.method}
                      </p>
                      <p className="text-xs text-gray-500">{formatDate(tx.created_at)}</p>
                      {tx.reference && <p className="text-xs text-gray-400">مرجع: {tx.reference}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <p className={`font-bold ${tx.type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.type === 'deposit' ? '+' : ''}{tx.amount?.toLocaleString()} ر.س
                      </p>
                      <p className={`text-xs ${tx.status === 'completed' ? 'text-green-600' : 'text-yellow-600'}`}>
                        {tx.status === 'completed' ? '✓ مكتمل' : '⏳ معلق'}
                      </p>
                    </div>
                    <Button
                      onClick={() => deleteTransaction(tx.id)}
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminWallet;
