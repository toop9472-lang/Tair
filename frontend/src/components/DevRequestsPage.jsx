import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { 
  Plus, 
  Send, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Trash2,
  Edit2,
  MessageSquare,
  Lightbulb,
  Bug,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const DevRequestsPage = ({ adminToken }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'feature',
    priority: 'medium'
  });

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/dev-requests`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      setRequests(response.data || []);
    } catch (error) {
      console.error('Failed to load requests:', error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast.error('يرجى إدخال عنوان الطلب');
      return;
    }

    try {
      if (editingId) {
        await axios.put(`${API_URL}/api/dev-requests/${editingId}`, formData, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        toast.success('تم تحديث الطلب بنجاح');
      } else {
        await axios.post(`${API_URL}/api/dev-requests`, formData, {
          headers: { Authorization: `Bearer ${adminToken}` }
        });
        toast.success('تم إضافة الطلب بنجاح');
      }
      
      setFormData({ title: '', description: '', type: 'feature', priority: 'medium' });
      setShowForm(false);
      setEditingId(null);
      loadRequests();
    } catch (error) {
      toast.error('فشل في حفظ الطلب');
    }
  };

  const deleteRequest = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الطلب؟')) return;
    
    try {
      await axios.delete(`${API_URL}/api/dev-requests/${id}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      toast.success('تم حذف الطلب');
      loadRequests();
    } catch (error) {
      toast.error('فشل في حذف الطلب');
    }
  };

  const editRequest = (request) => {
    setFormData({
      title: request.title,
      description: request.description,
      type: request.type,
      priority: request.priority
    });
    setEditingId(request.id);
    setShowForm(true);
  };

  const updateStatus = async (id, status) => {
    try {
      await axios.patch(`${API_URL}/api/dev-requests/${id}/status`, { status }, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      loadRequests();
    } catch (error) {
      toast.error('فشل في تحديث الحالة');
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'feature': return <Sparkles className="w-4 h-4 text-purple-500" />;
      case 'bug': return <Bug className="w-4 h-4 text-red-500" />;
      case 'improvement': return <Lightbulb className="w-4 h-4 text-yellow-500" />;
      default: return <MessageSquare className="w-4 h-4 text-blue-500" />;
    }
  };

  const getTypeName = (type) => {
    switch (type) {
      case 'feature': return 'ميزة جديدة';
      case 'bug': return 'إصلاح خطأ';
      case 'improvement': return 'تحسين';
      default: return 'أخرى';
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'high':
        return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">عالية</span>;
      case 'medium':
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">متوسطة</span>;
      case 'low':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">منخفضة</span>;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700 flex items-center gap-1"><Clock className="w-3 h-3" /> قيد الانتظار</span>;
      case 'in_progress':
        return <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> جاري التنفيذ</span>;
      case 'completed':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> مكتمل</span>;
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const completedRequests = requests.filter(r => r.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">📝 طلبات التطوير</h2>
              <p className="text-white/80">
                سجّل أفكارك وطلباتك هنا. عند العودة للمطور، سيتم تنفيذها!
              </p>
            </div>
            <Button
              onClick={() => { setShowForm(!showForm); setEditingId(null); setFormData({ title: '', description: '', type: 'feature', priority: 'medium' }); }}
              className="bg-white text-indigo-600 hover:bg-white/90"
            >
              <Plus className="w-4 h-4 ml-2" />
              طلب جديد
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold text-indigo-600">{requests.length}</div>
            <div className="text-sm text-gray-500">إجمالي الطلبات</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold text-yellow-600">{pendingRequests.length}</div>
            <div className="text-sm text-gray-500">قيد الانتظار</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-3xl font-bold text-green-600">{completedRequests.length}</div>
            <div className="text-sm text-gray-500">مكتمل</div>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="border-2 border-indigo-200">
          <CardHeader>
            <CardTitle>{editingId ? 'تعديل الطلب' : 'إضافة طلب جديد'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>عنوان الطلب *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="مثال: إضافة إشعارات Push"
                />
              </div>
              
              <div>
                <Label>الوصف التفصيلي</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="اشرح ماذا تريد بالتفصيل..."
                  rows={4}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>نوع الطلب</Label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="feature">✨ ميزة جديدة</option>
                    <option value="bug">🐛 إصلاح خطأ</option>
                    <option value="improvement">💡 تحسين</option>
                    <option value="other">📝 أخرى</option>
                  </select>
                </div>
                
                <div>
                  <Label>الأولوية</Label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full p-2 border rounded-lg"
                  >
                    <option value="high">🔴 عالية</option>
                    <option value="medium">🟡 متوسطة</option>
                    <option value="low">🟢 منخفضة</option>
                  </select>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  <Send className="w-4 h-4 ml-2" />
                  {editingId ? 'تحديث' : 'إضافة'}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>
                  إلغاء
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Requests List */}
      <Card>
        <CardHeader>
          <CardTitle>قائمة الطلبات</CardTitle>
          <CardDescription>
            اضغط على الطلب لتعديله أو تغيير حالته
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">جاري التحميل...</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📭</div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">لا توجد طلبات</h3>
              <p className="text-gray-500 mb-4">ابدأ بإضافة طلبك الأول!</p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 ml-2" />
                إضافة طلب
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className={`p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                    request.status === 'completed' ? 'bg-green-50 border-green-200' : 
                    request.status === 'in_progress' ? 'bg-blue-50 border-blue-200' : 
                    'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">{getTypeIcon(request.type)}</div>
                      <div>
                        <h4 className="font-bold text-gray-800">{request.title}</h4>
                        {request.description && (
                          <p className="text-sm text-gray-600 mt-1">{request.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          {getStatusBadge(request.status)}
                          {getPriorityBadge(request.priority)}
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(request.created_at).toLocaleDateString('ar-SA')}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {request.status !== 'completed' && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => editRequest(request)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateStatus(request.id, 'completed')}
                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteRequest(request.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      >
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

      {/* Instructions */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-4">
          <h4 className="font-bold text-amber-800 mb-2">💡 كيف تستخدم هذه الصفحة؟</h4>
          <ol className="text-sm text-amber-700 space-y-1 list-decimal list-inside">
            <li>سجّل كل فكرة أو طلب تعديل هنا</li>
            <li>حدد الأولوية والنوع</li>
            <li>عند العودة للمطور، قل له "نفذ طلبات التطوير"</li>
            <li>سيقوم بتنفيذها حسب الأولوية</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
};

export default DevRequestsPage;
