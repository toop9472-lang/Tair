import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { toast } from '../hooks/use-toast';
import axios from 'axios';
import { Trash2, Check, X, Eye, Play, Pause, Bot, RefreshCw, Settings2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdsManagementPage = ({ adminToken }) => {
  const [allAds, setAllAds] = useState({ main_ads: [], advertiser_ads: [] });
  const [pendingAds, setPendingAds] = useState([]);
  const [aiSettings, setAiSettings] = useState({
    enabled: false,
    auto_approve_paid: true,
    content_check: true,
    require_video: true,
    min_duration: 15,
    max_duration: 300
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [filter, setFilter] = useState('all'); // all, active, pending, inactive

  const getAuthHeaders = () => ({ Authorization: `Bearer ${adminToken}` });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const headers = getAuthHeaders();
      
      const [allAdsRes, pendingRes, settingsRes] = await Promise.all([
        axios.get(`${API}/admin/dashboard/ads/all`, { headers }),
        axios.get(`${API}/admin/dashboard/ads/pending`, { headers }),
        axios.get(`${API}/admin/dashboard/ai-approval/settings`, { headers })
      ]);
      
      setAllAds(allAdsRes.data);
      setPendingAds(pendingRes.data.ads || []);
      setAiSettings(settingsRes.data);
    } catch (error) {
      console.error('Failed to load ads:', error);
      toast({ title: '❌ خطأ', description: 'فشل تحميل البيانات', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAd = async (adId, adTitle) => {
    if (!window.confirm(`⚠️ هل أنت متأكد من حذف الإعلان "${adTitle}" نهائياً؟`)) return;
    
    try {
      const headers = getAuthHeaders();
      await axios.delete(`${API}/admin/dashboard/ads/${adId}`, { headers });
      toast({ title: '✅ تم', description: 'تم حذف الإعلان نهائياً' });
      loadData();
    } catch (error) {
      toast({ title: '❌ خطأ', description: 'فشل حذف الإعلان', variant: 'destructive' });
    }
  };

  const handleApproveAd = async (adId) => {
    try {
      const headers = getAuthHeaders();
      await axios.put(`${API}/admin/dashboard/ads/${adId}/approve`, {}, { headers });
      toast({ title: '✅ تم', description: 'تم تفعيل الإعلان' });
      loadData();
    } catch (error) {
      toast({ title: '❌ خطأ', description: 'فشل تفعيل الإعلان', variant: 'destructive' });
    }
  };

  const handleRejectAd = async (adId) => {
    const reason = prompt('سبب الرفض:');
    if (!reason) return;
    
    try {
      const headers = getAuthHeaders();
      await axios.put(`${API}/admin/dashboard/ads/${adId}/reject`, { reason }, { headers });
      toast({ title: '✅ تم', description: 'تم رفض الإعلان' });
      loadData();
    } catch (error) {
      toast({ title: '❌ خطأ', description: 'فشل رفض الإعلان', variant: 'destructive' });
    }
  };

  const handleDeactivateAd = async (adId) => {
    try {
      const headers = getAuthHeaders();
      await axios.put(`${API}/admin/dashboard/ads/${adId}/deactivate`, {}, { headers });
      toast({ title: '✅ تم', description: 'تم إيقاف الإعلان' });
      loadData();
    } catch (error) {
      toast({ title: '❌ خطأ', description: 'فشل إيقاف الإعلان', variant: 'destructive' });
    }
  };

  const handleActivateAd = async (adId) => {
    try {
      const headers = getAuthHeaders();
      await axios.put(`${API}/admin/dashboard/ads/${adId}/activate`, {}, { headers });
      toast({ title: '✅ تم', description: 'تم تفعيل الإعلان' });
      loadData();
    } catch (error) {
      toast({ title: '❌ خطأ', description: 'فشل تفعيل الإعلان', variant: 'destructive' });
    }
  };

  const handleAIProcess = async (adId) => {
    try {
      const headers = getAuthHeaders();
      const response = await axios.post(`${API}/admin/dashboard/ai-approval/process/${adId}`, {}, { headers });
      
      if (response.data.approved) {
        toast({ title: '✅ تمت الموافقة', description: response.data.message });
      } else {
        const issues = response.data.issues?.join('\n• ') || 'لم يتم تحديد السبب';
        toast({ 
          title: '⚠️ لم تتم الموافقة', 
          description: `الأسباب:\n• ${issues}`,
          variant: 'destructive'
        });
      }
      loadData();
    } catch (error) {
      toast({ title: '❌ خطأ', description: 'فشل المعالجة بالذكاء الاصطناعي', variant: 'destructive' });
    }
  };

  const handleSaveAISettings = async () => {
    try {
      const headers = getAuthHeaders();
      await axios.put(`${API}/admin/dashboard/ai-approval/settings`, aiSettings, { headers });
      toast({ title: '✅ تم', description: 'تم حفظ إعدادات الموافقة التلقائية' });
    } catch (error) {
      toast({ title: '❌ خطأ', description: 'فشل حفظ الإعدادات', variant: 'destructive' });
    }
  };

  // Combine all ads for display
  const getAllAdsForDisplay = () => {
    const mainAds = allAds.main_ads || [];
    const advertiserAds = allAds.advertiser_ads || [];
    
    // Merge and remove duplicates
    const adsMap = new Map();
    
    mainAds.forEach(ad => {
      adsMap.set(ad.id, { ...ad, source: 'main' });
    });
    
    advertiserAds.forEach(ad => {
      if (!adsMap.has(ad.id)) {
        adsMap.set(ad.id, { ...ad, source: 'advertiser' });
      } else {
        // Update with advertiser info
        adsMap.set(ad.id, { ...adsMap.get(ad.id), ...ad, source: 'both' });
      }
    });
    
    let ads = Array.from(adsMap.values());
    
    // Apply filter
    if (filter === 'active') {
      ads = ads.filter(ad => ad.is_active || ad.status === 'active');
    } else if (filter === 'pending') {
      ads = ads.filter(ad => ad.status === 'pending');
    } else if (filter === 'inactive') {
      ads = ads.filter(ad => !ad.is_active || ad.status === 'inactive' || ad.status === 'rejected');
    }
    
    return ads;
  };

  const getStatusBadge = (ad) => {
    if (ad.status === 'rejected') {
      return <Badge variant="destructive">مرفوض</Badge>;
    }
    if (ad.status === 'pending') {
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">معلق</Badge>;
    }
    if (ad.is_active || ad.status === 'active') {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">نشط</Badge>;
    }
    return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">متوقف</Badge>;
  };

  if (isLoading) {
    return <div className="text-center py-8">جاري التحميل...</div>;
  }

  const displayAds = getAllAdsForDisplay();

  return (
    <div className="space-y-6">
      {/* AI Auto-Approval Settings */}
      <Card className="border-2 border-indigo-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-indigo-600" />
              <CardTitle className="text-lg">الموافقة التلقائية بالذكاء الاصطناعي</CardTitle>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">تفعيل</span>
                <Switch
                  checked={aiSettings.enabled}
                  onCheckedChange={(checked) => setAiSettings({ ...aiSettings, enabled: checked })}
                />
              </div>
              <Button 
                onClick={() => setShowSettings(!showSettings)} 
                variant="outline" 
                size="sm"
              >
                <Settings2 className="w-4 h-4 ml-1" />
                إعدادات
              </Button>
            </div>
          </div>
          <CardDescription>
            {aiSettings.enabled 
              ? '✅ الموافقة التلقائية مفعّلة - سيتم فحص الإعلانات تلقائياً'
              : '⚪ الموافقة التلقائية معطّلة - يتطلب موافقة يدوية'
            }
          </CardDescription>
        </CardHeader>
        
        {showSettings && (
          <CardContent className="border-t pt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm">الموافقة بعد الدفع فقط</span>
                <Switch
                  checked={aiSettings.auto_approve_paid}
                  onCheckedChange={(checked) => setAiSettings({ ...aiSettings, auto_approve_paid: checked })}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm">التحقق من المحتوى</span>
                <Switch
                  checked={aiSettings.content_check}
                  onCheckedChange={(checked) => setAiSettings({ ...aiSettings, content_check: checked })}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm">يتطلب فيديو</span>
                <Switch
                  checked={aiSettings.require_video}
                  onCheckedChange={(checked) => setAiSettings({ ...aiSettings, require_video: checked })}
                />
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <label className="text-sm block mb-2">الحد الأدنى للمدة (ثانية)</label>
                <Input
                  type="number"
                  value={aiSettings.min_duration}
                  onChange={(e) => setAiSettings({ ...aiSettings, min_duration: parseInt(e.target.value) || 15 })}
                />
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <label className="text-sm block mb-2">الحد الأقصى للمدة (ثانية)</label>
                <Input
                  type="number"
                  value={aiSettings.max_duration}
                  onChange={(e) => setAiSettings({ ...aiSettings, max_duration: parseInt(e.target.value) || 300 })}
                />
              </div>
              <div className="p-3 flex items-end">
                <Button onClick={handleSaveAISettings} className="w-full">
                  💾 حفظ الإعدادات
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Pending Ads Section */}
      {pendingAds.length > 0 && (
        <Card className="border-2 border-yellow-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></span>
              إعلانات تنتظر الموافقة ({pendingAds.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingAds.map((ad) => (
                <div key={ad.id} className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex-1">
                    <h4 className="font-semibold">{ad.title}</h4>
                    <p className="text-sm text-gray-600">{ad.advertiser_name} • {ad.duration} ثانية • {ad.price} ر.س</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {aiSettings.enabled && (
                      <Button onClick={() => handleAIProcess(ad.id)} variant="outline" size="sm" className="text-indigo-600">
                        <Bot className="w-4 h-4 ml-1" />
                        AI
                      </Button>
                    )}
                    <Button onClick={() => handleApproveAd(ad.id)} size="sm" className="bg-green-600 hover:bg-green-700">
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button onClick={() => handleRejectAd(ad.id)} variant="destructive" size="sm">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Ads Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">جميع الإعلانات ({displayAds.length})</CardTitle>
            <div className="flex items-center gap-2">
              <select 
                className="border rounded-lg px-3 py-2 text-sm"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">الكل</option>
                <option value="active">النشطة</option>
                <option value="pending">المعلقة</option>
                <option value="inactive">المتوقفة</option>
              </select>
              <Button onClick={loadData} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {displayAds.length === 0 ? (
            <p className="text-center text-gray-500 py-8">لا توجد إعلانات</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-right p-3 text-sm font-semibold">الإعلان</th>
                    <th className="text-right p-3 text-sm font-semibold">المعلن</th>
                    <th className="text-center p-3 text-sm font-semibold">المدة</th>
                    <th className="text-center p-3 text-sm font-semibold">الحالة</th>
                    <th className="text-center p-3 text-sm font-semibold">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayAds.map((ad) => (
                    <tr key={ad.id} className="hover:bg-gray-50">
                      <td className="p-3">
                        <div>
                          <p className="font-semibold">{ad.title}</p>
                          <p className="text-xs text-gray-500 truncate max-w-xs">{ad.description}</p>
                        </div>
                      </td>
                      <td className="p-3 text-sm">{ad.advertiser_name || ad.advertiser || '-'}</td>
                      <td className="p-3 text-center text-sm">{ad.duration || '-'} ثانية</td>
                      <td className="p-3 text-center">{getStatusBadge(ad)}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1">
                          {ad.video_url && (
                            <Button
                              onClick={() => window.open(ad.video_url, '_blank')}
                              variant="ghost"
                              size="sm"
                              title="مشاهدة الفيديو"
                            >
                              <Eye className="w-4 h-4 text-blue-600" />
                            </Button>
                          )}
                          {(ad.is_active || ad.status === 'active') ? (
                            <Button
                              onClick={() => handleDeactivateAd(ad.id)}
                              variant="ghost"
                              size="sm"
                              title="إيقاف"
                            >
                              <Pause className="w-4 h-4 text-orange-600" />
                            </Button>
                          ) : ad.status !== 'rejected' && (
                            <Button
                              onClick={() => handleActivateAd(ad.id)}
                              variant="ghost"
                              size="sm"
                              title="تفعيل"
                            >
                              <Play className="w-4 h-4 text-green-600" />
                            </Button>
                          )}
                          <Button
                            onClick={() => handleDeleteAd(ad.id, ad.title)}
                            variant="ghost"
                            size="sm"
                            title="حذف نهائي"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdsManagementPage;
