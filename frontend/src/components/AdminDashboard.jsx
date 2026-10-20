import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { toast } from '../hooks/use-toast';
import axios from 'axios';
import AdminSettings from './AdminSettings';
import AdminAIAssistant from './AdminAIAssistant';
import DevRequestsPage from './DevRequestsPage';
import AdsManagementPage from './AdsManagementPage';
import AdminKycPage from './AdminKycPage';
import AdminPushTest from './AdminPushTest';
import { Search, Ban, Trash2, UserCheck, RefreshCw, Eye, Edit2, Bot, FileText, Video, ShieldCheck, Bell } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminDashboard = ({ admin, onLogout }) => {
  const [stats, setStats] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [pendingWithdrawals, setPendingWithdrawals] = useState([]);
  const [pendingAds, setPendingAds] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [usersPage, setUsersPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('admin_token');
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => {
    loadDashboardData();
    // Refresh user stats every 30 seconds
    const interval = setInterval(loadUserStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadUserStats = async () => {
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API}/activity/user-stats`, { headers });
      setUserStats(response.data);
    } catch (error) {
      console.error('Failed to load user stats:', error);
    }
  };

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const headers = getAuthHeaders();

      // Load stats
      const statsResponse = await axios.get(`${API}/admin/dashboard/stats`, { headers });
      setStats(statsResponse.data);

      // Load user activity stats
      await loadUserStats();

      // Load pending withdrawals
      const withdrawalsResponse = await axios.get(`${API}/admin/dashboard/withdrawals/pending`, { headers });
      setPendingWithdrawals(withdrawalsResponse.data.withdrawals);

      // Load pending ads
      const adsResponse = await axios.get(`${API}/admin/dashboard/ads/pending`, { headers });
      setPendingAds(adsResponse.data.ads);
      
      // Load all users
      await loadUsers();

    } catch (error) {
      console.error('Failed to load dashboard:', error);
      toast({
        title: 'خطأ',
        description: 'فشل تحميل البيانات',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async (page = 1, search = '') => {
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API}/admin/users/list`, {
        headers,
        params: { page, limit: 20, search }
      });
      setAllUsers(response.data.users);
      setTotalUsers(response.data.total);
      setUsersPage(page);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const handleBanUser = async (userId, userName) => {
    if (!window.confirm(`هل أنت متأكد من حظر المستخدم "${userName}"؟`)) return;
    
    try {
      const headers = getAuthHeaders();
      await axios.put(`${API}/admin/users/${userId}/ban`, null, { headers });
      toast({ title: 'تم', description: 'تم حظر المستخدم' });
      loadUsers(usersPage, userSearch);
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل حظر المستخدم', variant: 'destructive' });
    }
  };

  const handleUnbanUser = async (userId) => {
    try {
      const headers = getAuthHeaders();
      await axios.put(`${API}/admin/users/${userId}/unban`, null, { headers });
      toast({ title: 'تم', description: 'تم رفع الحظر' });
      loadUsers(usersPage, userSearch);
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل رفع الحظر', variant: 'destructive' });
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`تحذير: سيتم حذف المستخدم "${userName}" وجميع بياناته نهائياً. هل أنت متأكد؟`)) return;
    
    try {
      const headers = getAuthHeaders();
      await axios.delete(`${API}/admin/users/${userId}`, { headers });
      toast({ title: 'تم', description: 'تم حذف المستخدم' });
      loadUsers(usersPage, userSearch);
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل حذف المستخدم', variant: 'destructive' });
    }
  };

  const handleApproveWithdrawal = async (withdrawalId) => {
    try {
      const headers = getAuthHeaders();
      await axios.put(`${API}/admin/dashboard/withdrawals/${withdrawalId}/approve`, {}, { headers });
      
      toast({
        title: 'تمت الموافقة',
        description: 'تمت الموافقة على طلب السحب',
      });
      
      loadDashboardData();
    } catch (error) {
      console.error('Approve error:', error);
      toast({
        title: 'خطأ',
        description: 'فشلت الموافقة',
        variant: 'destructive'
      });
    }
  };

  const handleRejectWithdrawal = async (withdrawalId) => {
    const reason = prompt('سبب الرفض:');
    if (!reason) return;

    try {
      const headers = getAuthHeaders();
      await axios.put(`${API}/admin/dashboard/withdrawals/${withdrawalId}/reject`, { reason }, { headers });
      
      toast({
        title: 'تم الرفض',
        description: 'تم رفض الطلب وإرجاع النقاط',
      });
      
      loadDashboardData();
    } catch (error) {
      console.error('Reject error:', error);
      toast({
        title: 'خطأ',
        description: 'فشل الرفض',
        variant: 'destructive'
      });
    }
  };

  const handleApproveAd = async (adId) => {
    try {
      const headers = getAuthHeaders();
      await axios.put(`${API}/admin/dashboard/ads/${adId}/approve`, {}, { headers });
      
      toast({
        title: 'تمت الموافقة',
        description: 'تم تفعيل الإعلان',
      });
      
      loadDashboardData();
    } catch (error) {
      console.error('Approve ad error:', error);
      toast({
        title: 'خطأ',
        description: 'فشلت الموافقة',
        variant: 'destructive'
      });
    }
  };

  const handleRejectAd = async (adId) => {
    const reason = prompt('سبب رفض الإعلان:');
    if (!reason) return;

    try {
      const headers = getAuthHeaders();
      await axios.put(`${API}/admin/dashboard/ads/${adId}/reject`, { reason }, { headers });
      
      toast({
        title: 'تم الرفض',
        description: 'تم رفض الإعلان',
      });
      
      loadDashboardData();
    } catch (error) {
      console.error('Reject ad error:', error);
      toast({
        title: 'خطأ',
        description: 'فشل الرفض',
        variant: 'destructive'
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <p className="text-gray-300">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-4 pt-8 pb-20 shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-white text-2xl font-bold">لوحة التحكم</h1>
            <p className="text-gray-400 text-sm mt-1">مرحباً {admin.name}</p>
          </div>
          <Button
            onClick={onLogout}
            variant="ghost"
            className="text-white hover:bg-white/20"
          >
            تسجيل الخروج
          </Button>
        </div>
      </div>

      {/* User Status Cards - NEW */}
      <div className="px-4 -mt-12 mb-4">
        <div className="grid grid-cols-3 gap-3">
          <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-500 to-blue-600">
            <CardContent className="pt-4 pb-4">
              <div className="text-center text-white">
                <p className="text-xs opacity-80">إجمالي المستخدمين</p>
                <p className="text-3xl font-bold">{userStats?.users?.total || stats?.total_users || 0}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-gradient-to-br from-green-500 to-green-600">
            <CardContent className="pt-4 pb-4">
              <div className="text-center text-white">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <p className="text-xs opacity-80">نشط الآن</p>
                </div>
                <p className="text-3xl font-bold">{userStats?.users?.online || 0}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-gradient-to-br from-gray-600 to-gray-700">
            <CardContent className="pt-4 pb-4">
              <div className="text-center text-white">
                <p className="text-xs opacity-80">غير متصل</p>
                <p className="text-3xl font-bold">{userStats?.users?.offline || 0}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Financial Stats Cards */}
      <div className="px-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="shadow-lg border-0 bg-[#111118]">
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <p className="text-xs text-gray-400">الإيرادات</p>
                <p className="text-2xl font-bold text-green-400">{stats?.total_revenue || 0} ر.س</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-[#111118]">
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <p className="text-xs text-gray-400">المدفوعات</p>
                <p className="text-2xl font-bold text-red-400">{stats?.total_payouts || 0} $</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-[#111118]">
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <p className="text-xs text-gray-400">صافي الربح</p>
                <p className="text-2xl font-bold text-indigo-400">{stats?.net_profit || 0} ر.س</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-0 bg-[#111118]">
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <p className="text-xs text-gray-400">إعلانات نشطة</p>
                <p className="text-2xl font-bold text-purple-400">{stats?.active_ads || 0}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Ad Stats Cards - NEW */}
      <div className="px-4 mb-6">
        <Card className="shadow-lg border-0 bg-[#111118]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-white">إحصائيات الإعلانات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 bg-blue-500/20 rounded-lg">
                <p className="text-2xl font-bold text-blue-400">{userStats?.ads?.total_views || 0}</p>
                <p className="text-xs text-gray-400">مشاهدات</p>
              </div>
              <div className="text-center p-3 bg-green-500/20 rounded-lg">
                <p className="text-2xl font-bold text-green-400">{userStats?.ads?.completed_views || 0}</p>
                <p className="text-xs text-gray-400">مكتملة</p>
              </div>
              <div className="text-center p-3 bg-purple-500/20 rounded-lg">
                <p className="text-2xl font-bold text-purple-400">{userStats?.ads?.completion_rate || 0}%</p>
                <p className="text-xs text-gray-400">نسبة الإكمال</p>
              </div>
              <div className="text-center p-3 bg-orange-500/20 rounded-lg">
                <p className="text-2xl font-bold text-orange-400">{userStats?.ads?.avg_views_per_ad || 0}</p>
                <p className="text-xs text-gray-400">متوسط/إعلان</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="px-4">
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="flex flex-wrap gap-2 h-auto p-2 bg-[#111118] rounded-lg">
            <TabsTrigger value="users" className="flex-1 min-w-[100px] text-xs py-2 text-gray-300 data-[state=active]:bg-white/10 data-[state=active]:text-white">
              المستخدمون ({totalUsers})
            </TabsTrigger>
            <TabsTrigger value="withdrawals" className="flex-1 min-w-[100px] text-xs py-2 text-gray-300 data-[state=active]:bg-white/10 data-[state=active]:text-white">
              السحوبات ({pendingWithdrawals.length})
            </TabsTrigger>
            <TabsTrigger value="ads" className="flex-1 min-w-[100px] text-xs py-2 flex items-center justify-center gap-1 text-gray-300 data-[state=active]:bg-white/10 data-[state=active]:text-white">
              <Video className="w-3 h-3" /> الإعلانات ({pendingAds.length})
            </TabsTrigger>
            <TabsTrigger value="ai-assistant" className="flex-1 min-w-[100px] text-xs py-2 flex items-center justify-center gap-1 text-gray-300 data-[state=active]:bg-white/10 data-[state=active]:text-white">
              <Bot className="w-3 h-3" /> مساعد AI
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex-1 min-w-[100px] text-xs py-2 text-gray-300 data-[state=active]:bg-white/10 data-[state=active]:text-white">
              التحليلات
            </TabsTrigger>
            <TabsTrigger value="invoices" className="flex-1 min-w-[100px] text-xs py-2 text-gray-300 data-[state=active]:bg-white/10 data-[state=active]:text-white">
              الفواتير
            </TabsTrigger>
            <TabsTrigger value="dev-requests" className="flex-1 min-w-[100px] text-xs py-2 flex items-center justify-center gap-1 text-gray-300 data-[state=active]:bg-white/10 data-[state=active]:text-white">
              <FileText className="w-3 h-3" /> طلبات التطوير
            </TabsTrigger>
            <TabsTrigger value="kyc" className="flex-1 min-w-[100px] text-xs py-2 flex items-center justify-center gap-1 text-gray-300 data-[state=active]:bg-white/10 data-[state=active]:text-white">
              <ShieldCheck className="w-3 h-3" /> توثيق KYC
            </TabsTrigger>
            <TabsTrigger value="push" className="flex-1 min-w-[100px] text-xs py-2 flex items-center justify-center gap-1 text-gray-300 data-[state=active]:bg-white/10 data-[state=active]:text-white">
              <Bell className="w-3 h-3" /> اختبار Push
            </TabsTrigger>
            <TabsTrigger value="rewards" className="flex-1 min-w-[100px] text-xs py-2 text-gray-300 data-[state=active]:bg-white/10 data-[state=active]:text-white">
              المكافآت
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-1 min-w-[100px] text-xs py-2 text-gray-300 data-[state=active]:bg-white/10 data-[state=active]:text-white">
              الإعدادات
            </TabsTrigger>
          </TabsList>

          {/* Users Management Tab */}
          <TabsContent value="users" className="mt-4">
            <Card className="bg-[#111118] border-white/10">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between text-white">
                  <span>إدارة المستخدمين</span>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <Input
                        placeholder="بحث بالاسم أو البريد..."
                        value={userSearch}
                        onChange={(e) => {
                          setUserSearch(e.target.value);
                          loadUsers(1, e.target.value);
                        }}
                        className="pr-10 w-64 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                      />
                    </div>
                    <Button onClick={() => loadUsers(usersPage, userSearch)} variant="ghost" size="sm" className="text-gray-300 hover:text-white hover:bg-white/10">
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription className="text-gray-400">
                  إجمالي: {totalUsers} | 
                  نشط الآن: {userStats?.users?.online || 0} | 
                  نشط آخر 24 ساعة: {userStats?.users?.active_24h || 0}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {allUsers.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">لا يوجد مستخدمون</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-white/5">
                        <tr>
                          <th className="text-right p-3 text-sm font-semibold text-gray-300">المستخدم</th>
                          <th className="text-right p-3 text-sm font-semibold text-gray-300">البريد</th>
                          <th className="text-center p-3 text-sm font-semibold text-gray-300">النقاط</th>
                          <th className="text-center p-3 text-sm font-semibold text-gray-300">الحالة</th>
                          <th className="text-center p-3 text-sm font-semibold text-gray-300">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {allUsers.map((user) => (
                          <tr key={user.user_id || user.id} className="hover:bg-white/5">
                            <td className="p-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${user.is_banned ? 'bg-red-500' : 'bg-indigo-500'}`}>
                                  {(user.name || 'U')[0].toUpperCase()}
                                </div>
                                <span className="font-medium text-white">{user.name || 'بدون اسم'}</span>
                              </div>
                            </td>
                            <td className="p-3 text-sm text-gray-400" dir="ltr">{user.email}</td>
                            <td className="p-3 text-center">
                              <span className="font-bold text-indigo-400">{user.points || 0}</span>
                              <span className="text-xs text-gray-500 block">مكتسبة: {user.total_earned || 0}</span>
                            </td>
                            <td className="p-3 text-center">
                              {user.is_banned ? (
                                <Badge variant="destructive">محظور</Badge>
                              ) : (
                                <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">نشط</Badge>
                              )}
                              <div className="text-[10px] text-gray-500 mt-1" data-testid={`user-lastseen-${user.user_id || user.id}`}>
                                {user.last_seen ? `آخر ظهور: ${new Date(user.last_seen).toLocaleString('ar-SA', { hour: 'numeric', minute: '2-digit', day: '2-digit', month: '2-digit' })}` : (user.last_login ? `آخر دخول: ${new Date(user.last_login).toLocaleDateString('ar-SA')}` : 'لم يظهر بعد')}
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-1">
                                {user.is_banned ? (
                                  <Button
                                    onClick={() => handleUnbanUser(user.user_id || user.id)}
                                    variant="ghost"
                                    size="sm"
                                    className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                                    title="رفع الحظر"
                                  >
                                    <UserCheck className="w-4 h-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    onClick={() => handleBanUser(user.user_id || user.id, user.name)}
                                    variant="ghost"
                                    size="sm"
                                    className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                                    title="حظر"
                                  >
                                    <Ban className="w-4 h-4" />
                                  </Button>
                                )}
                                <Button
                                  onClick={() => handleDeleteUser(user.user_id || user.id, user.name)}
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                  title="حذف"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                {/* Pagination */}
                {totalUsers > 20 && (
                  <div className="flex justify-center gap-2 mt-4 pt-4 border-t border-white/10">
                    <Button
                      onClick={() => loadUsers(usersPage - 1, userSearch)}
                      disabled={usersPage <= 1}
                      variant="outline"
                      size="sm"
                      className="border-white/20 text-gray-300 hover:bg-white/10"
                    >
                      السابق
                    </Button>
                    <span className="px-4 py-2 text-sm bg-white/5 text-gray-300 rounded">
                      صفحة {usersPage} من {Math.ceil(totalUsers / 20)}
                    </span>
                    <Button
                      onClick={() => loadUsers(usersPage + 1, userSearch)}
                      disabled={usersPage >= Math.ceil(totalUsers / 20)}
                      variant="outline"
                      size="sm"
                      className="border-white/20 text-gray-300 hover:bg-white/10"
                    >
                      التالي
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pending Withdrawals */}
          <TabsContent value="withdrawals" className="space-y-4 mt-4">
            {pendingWithdrawals.length === 0 ? (
              <Card className="bg-[#111118] border-white/10">
                <CardContent className="pt-6 text-center text-gray-500">
                  لا توجد طلبات سحب معلقة
                </CardContent>
              </Card>
            ) : (
              pendingWithdrawals.map((withdrawal) => (
                <Card key={withdrawal.id} className="shadow-md bg-[#111118] border-white/10">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg text-white">{withdrawal.user_name || 'مستخدم'}</CardTitle>
                        <CardDescription className="text-gray-400">{withdrawal.user_email}</CardDescription>
                      </div>
                      <Badge variant="outline" className="text-gray-300 border-white/20">{withdrawal.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-4">
                      <p className="text-sm text-gray-300"><strong className="text-white">المبلغ:</strong> ${withdrawal.amount}</p>
                      <p className="text-sm text-gray-300"><strong className="text-white">النقاط:</strong> {withdrawal.points}</p>
                      <p className="text-sm text-gray-300"><strong className="text-white">الطريقة:</strong> {withdrawal.method_name}</p>
                      <div className="bg-white/5 p-3 rounded-lg mt-2 border border-white/10">
                        <p className="text-sm font-semibold mb-1 text-white">تفاصيل الحساب:</p>
                        {Object.entries(withdrawal.details || {}).map(([key, value]) => (
                          <p key={key} className="text-sm text-gray-300"><strong className="text-gray-400">{key}:</strong> {value}</p>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleApproveWithdrawal(withdrawal.id)}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        ✓ موافقة
                      </Button>
                      <Button
                        onClick={() => handleRejectWithdrawal(withdrawal.id)}
                        variant="destructive"
                        className="flex-1"
                      >
                        ✗ رفض
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Ads Management */}
          <TabsContent value="ads" className="mt-4">
            <AdsManagementPage adminToken={localStorage.getItem('admin_token')} />
          </TabsContent>

          {/* AI Assistant Tab */}
          <TabsContent value="ai-assistant" className="mt-4">
            <AdminAIAssistant adminToken={localStorage.getItem('admin_token')} />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-4">
            <AnalyticsContent />
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="mt-4">
            <InvoicesContent />
          </TabsContent>

          {/* Development Requests Tab */}
          <TabsContent value="dev-requests" className="mt-4">
            <DevRequestsPage adminToken={localStorage.getItem('admin_token')} />
          </TabsContent>

          {/* KYC Verification Tab */}
          <TabsContent value="kyc" className="mt-4">
            <AdminKycPage admin={admin} />
          </TabsContent>

          {/* Push Notifications Test Tab */}
          <TabsContent value="push" className="mt-4">
            <AdminPushTest />
          </TabsContent>

          {/* Rewards Settings Tab */}
          <TabsContent value="rewards" className="mt-4">
            <RewardsSettingsContent getAuthHeaders={getAuthHeaders} />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-4">
            <AdminSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

// Rewards Settings Content Component
const RewardsSettingsContent = ({ getAuthHeaders }) => {
  const [settings, setSettings] = useState({
    points_per_ad: 5,
    min_watch_time: 30,
    points_per_dollar: 500,
    daily_limit: 50,
    min_withdrawal: 500,
    daily_challenges: [
      { title: 'المشاهد النشط', target: 5, reward: 25, icon: 'عين', desc: 'شاهد 5 إعلانات', enabled: true },
      { title: 'جامع النقاط', target: 50, reward: 30, icon: 'نجمة', desc: 'اكسب 50 نقطة', enabled: true },
      { title: 'المثابر', target: 10, reward: 50, icon: 'نار', desc: 'شاهد 10 إعلانات متتالية', enabled: true },
    ],
    tips: [
      { icon: 'فكرة', text: 'شاهد 10 إعلانات = 50 نقطة!', enabled: true },
      { icon: 'هدف', text: 'كل 500 نقطة = 1 دولار', enabled: true },
      { icon: '⚡', text: 'الإعلانات الجديدة تعطي نقاط أكثر', enabled: true },
    ]
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API}/admin/settings/rewards`, { headers });
      if (response.data) {
        setSettings(prev => ({ ...prev, ...response.data }));
      }
    } catch (error) {
      console.log('Using default rewards settings');
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const headers = getAuthHeaders();
      await axios.put(`${API}/admin/settings/rewards`, settings, { headers });
      toast({ title: 'تم الحفظ', description: 'تم حفظ إعدادات المكافآت بنجاح' });
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل حفظ الإعدادات', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const updateChallenge = (index, field, value) => {
    const newChallenges = [...settings.daily_challenges];
    newChallenges[index] = { ...newChallenges[index], [field]: value };
    setSettings({ ...settings, daily_challenges: newChallenges });
  };

  const updateTip = (index, field, value) => {
    const newTips = [...settings.tips];
    newTips[index] = { ...newTips[index], [field]: value };
    setSettings({ ...settings, tips: newTips });
  };

  if (isLoading) {
    return <div className="p-4 text-center text-gray-400">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      {/* الإعدادات الأساسية */}
      <Card className="bg-[#111118] border-white/10">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-white">
            إعدادات النقاط الأساسية
          </CardTitle>
          <CardDescription className="text-gray-400">تحكم في قيم النقاط والمكافآت</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">النقاط لكل إعلان</label>
              <Input
                type="number"
                value={settings.points_per_ad}
                onChange={(e) => setSettings({ ...settings, points_per_ad: parseInt(e.target.value) || 0 })}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">وقت المشاهدة (ثانية)</label>
              <Input
                type="number"
                value={settings.min_watch_time}
                onChange={(e) => setSettings({ ...settings, min_watch_time: parseInt(e.target.value) || 30 })}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">نقاط = 1 دولار</label>
              <Input
                type="number"
                value={settings.points_per_dollar}
                onChange={(e) => setSettings({ ...settings, points_per_dollar: parseInt(e.target.value) || 500 })}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">الحد اليومي للإعلانات</label>
              <Input
                type="number"
                value={settings.daily_limit}
                onChange={(e) => setSettings({ ...settings, daily_limit: parseInt(e.target.value) || 50 })}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div className="col-span-2">
              <label className="text-sm text-gray-400 mb-1 block">الحد الأدنى للسحب (نقاط)</label>
              <Input
                type="number"
                value={settings.min_withdrawal}
                onChange={(e) => setSettings({ ...settings, min_withdrawal: parseInt(e.target.value) || 500 })}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* التحديات اليومية */}
      <Card className="bg-[#111118] border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-white">التحديات اليومية</CardTitle>
          <CardDescription className="text-gray-400">تظهر للمستخدمين في الصفحة الرئيسية</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings.daily_challenges.map((challenge, idx) => (
            <div key={idx} className="p-4 bg-white/5 rounded-xl space-y-3 border border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-2xl">{challenge.icon}</span>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={challenge.enabled}
                    onChange={(e) => updateChallenge(idx, 'enabled', e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-300">مفعّل</span>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="العنوان"
                  value={challenge.title}
                  onChange={(e) => updateChallenge(idx, 'title', e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                />
                <Input
                  placeholder="الوصف"
                  value={challenge.desc}
                  onChange={(e) => updateChallenge(idx, 'desc', e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                />
                <Input
                  type="number"
                  placeholder="الهدف"
                  value={challenge.target}
                  onChange={(e) => updateChallenge(idx, 'target', parseInt(e.target.value) || 0)}
                  className="bg-white/5 border-white/10 text-white"
                />
                <Input
                  type="number"
                  placeholder="المكافأة"
                  value={challenge.reward}
                  onChange={(e) => updateChallenge(idx, 'reward', parseInt(e.target.value) || 0)}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* النصائح */}
      <Card className="bg-[#111118] border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-white">نصائح الصفحة الرئيسية</CardTitle>
          <CardDescription className="text-gray-400">تظهر بشكل متحرك للمستخدمين</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {settings.tips.map((tip, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
              <span className="text-xl">{tip.icon}</span>
              <Input
                value={tip.text}
                onChange={(e) => updateTip(idx, 'text', e.target.value)}
                className="flex-1 bg-white/5 border-white/10 text-white"
              />
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={tip.enabled}
                  onChange={(e) => updateTip(idx, 'enabled', e.target.checked)}
                  className="rounded"
                />
              </label>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* زر الحفظ */}
      <Button 
        onClick={saveSettings} 
        disabled={isSaving}
        className="w-full bg-indigo-600 hover:bg-indigo-700"
      >
        {isSaving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
      </Button>
    </div>
  );
};

// Analytics Content Component
const AnalyticsContent = () => {
  const [analytics, setAnalytics] = useState(null);
  const [topAds, setTopAds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      
      const [analyticsRes, topAdsRes] = await Promise.all([
        axios.get(`${API}/analytics/platform/overview`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/analytics/top-ads?limit=5`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      setAnalytics(analyticsRes.data);
      setTopAds(topAdsRes.data.top_ads || []);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-gray-400">جاري التحميل...</div>;
  }

  const downloadCsv = async (path, filename) => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API}/admin/dashboard/${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        toast({
          title: '❌ فشل التنزيل',
          description: `HTTP ${res.status}`,
          variant: 'destructive',
        });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: '✓ تم التنزيل', description: filename });
    } catch (e) {
      toast({
        title: '❌ خطأ',
        description: String(e?.message || e),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Download Reports */}
      <Card className="bg-[#111118] border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <FileText size={18} className="text-cyan-400" />
            تقارير قابلة للتنزيل (CSV)
          </CardTitle>
          <CardDescription className="text-gray-400 text-xs">
            ملفات Excel متوافقة مع UTF-8 لكامل البيانات
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button
              onClick={() =>
                downloadCsv(
                  'export/users.csv',
                  `saqr_users_${new Date().toISOString().slice(0, 10)}.csv`,
                )
              }
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1"
              data-testid="download-users-csv"
            >
              <FileText size={14} /> المستخدمون
            </Button>
            <Button
              onClick={() =>
                downloadCsv(
                  'export/ads.csv',
                  `saqr_ads_${new Date().toISOString().slice(0, 10)}.csv`,
                )
              }
              className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1"
              data-testid="download-ads-csv"
            >
              <FileText size={14} /> الإعلانات
            </Button>
            <Button
              onClick={() =>
                downloadCsv(
                  'export/withdrawals.csv',
                  `saqr_withdrawals_${new Date().toISOString().slice(0, 10)}.csv`,
                )
              }
              className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1"
              data-testid="download-withdrawals-csv"
            >
              <FileText size={14} /> السحوبات
            </Button>
            <Button
              onClick={() =>
                downloadCsv(
                  'export/clips.csv',
                  `saqr_clips_${new Date().toISOString().slice(0, 10)}.csv`,
                )
              }
              className="bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1"
              data-testid="download-clips-csv"
            >
              <FileText size={14} /> الريلز
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-[#111118] border-white/10">
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-indigo-400">{analytics?.engagement?.total_views || 0}</p>
            <p className="text-xs text-gray-400">إجمالي المشاهدات</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111118] border-white/10">
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-green-400">{analytics?.users?.active_last_7_days || 0}</p>
            <p className="text-xs text-gray-400">نشط آخر 7 أيام</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111118] border-white/10">
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-purple-400">{analytics?.financials?.total_points_distributed || 0}</p>
            <p className="text-xs text-gray-400">نقاط موزعة</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111118] border-white/10">
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-orange-400">{analytics?.users?.activity_rate || 0}%</p>
            <p className="text-xs text-gray-400">معدل النشاط</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Ads */}
      <Card className="bg-[#111118] border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-white">أفضل الإعلانات</CardTitle>
        </CardHeader>
        <CardContent>
          {topAds.length === 0 ? (
            <p className="text-gray-500 text-center">لا توجد بيانات</p>
          ) : (
            <div className="space-y-2">
              {topAds.map((ad, i) => (
                <div key={ad.ad_id} className="flex justify-between items-center p-3 bg-white/5 rounded border border-white/10">
                  <div className="flex items-center gap-3">
                    <span className={`font-bold ${i === 0 ? 'text-yellow-400' : 'text-gray-500'}`}>#{i+1}</span>
                    <span className="font-medium text-white">{ad.title}</span>
                  </div>
                  <span className="font-bold text-indigo-400">{ad.views} مشاهدة</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Invoices Content Component
const InvoicesContent = () => {
  const [invoices, setInvoices] = useState([]);
  const [stats, setStats] = useState({ total_revenue: 0, pending_amount: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await axios.get(`${API}/invoices/admin/all`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      
      setInvoices(response.data.invoices || []);
      setStats({
        total_revenue: response.data.total_revenue || 0,
        pending_amount: response.data.pending_amount || 0
      });
    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const variants = { paid: 'default', pending: 'secondary', cancelled: 'destructive' };
    const labels = { paid: 'مدفوعة', pending: 'معلقة', cancelled: 'ملغية' };
    return <Badge variant={variants[status] || 'secondary'}>{labels[status] || status}</Badge>;
  };

  if (isLoading) {
    return <div className="text-center py-8 text-gray-400">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-[#111118] border-white/10">
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-green-400">{stats.total_revenue.toFixed(2)} ر.س</p>
            <p className="text-xs text-gray-400">إجمالي الإيرادات</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111118] border-white/10">
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-yellow-400">{stats.pending_amount.toFixed(2)} ر.س</p>
            <p className="text-xs text-gray-400">مبالغ معلقة</p>
          </CardContent>
        </Card>
      </div>

      {/* Invoices List */}
      <Card className="bg-[#111118] border-white/10">
        <CardHeader>
          <CardTitle className="text-lg text-white">الفواتير الأخيرة</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-gray-500 text-center">لا توجد فواتير</p>
          ) : (
            <div className="space-y-2">
              {invoices.slice(0, 10).map((inv) => (
                <div key={inv.id} className="flex justify-between items-center p-3 bg-white/5 rounded border border-white/10">
                  <div>
                    <p className="font-mono text-sm text-white">{inv.invoice_number}</p>
                    <p className="text-xs text-gray-400">{inv.advertiser_name}</p>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-white">{inv.total?.toFixed(2)} ر.س</p>
                    {getStatusBadge(inv.status)}
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

export default AdminDashboard;
