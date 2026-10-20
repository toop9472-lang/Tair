import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { 
  Bot, 
  TrendingUp, 
  Users, 
  AlertTriangle, 
  Lightbulb,
  RefreshCw,
  Send,
  Sparkles,
  BarChart3,
  Target,
  Zap,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AdminAIAssistant = ({ adminToken }) => {
  const [loading, setLoading] = useState(false);
  const [analysisType, setAnalysisType] = useState('overview');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [customQuery, setCustomQuery] = useState('');
  const [dashboardData, setDashboardData] = useState(null);
  const [aiStatus, setAiStatus] = useState(null);

  useEffect(() => {
    loadDashboardData();
    checkAIStatus();
  }, []);

  const checkAIStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/claude-ai/status`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      setAiStatus(response.data);
    } catch (error) {
      setAiStatus({ enabled: false });
    }
  };

  const loadDashboardData = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/settings/dashboard/stats`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      setDashboardData(response.data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  const analyzeWithAI = async (type, customPrompt = null) => {
    if (!aiStatus?.enabled) {
      toast.error('الذكاء الاصطناعي غير مفعل. يرجى تفعيله من إعدادات AI.');
      return;
    }

    setLoading(true);
    setAnalysisType(type);
    
    try {
      let prompt = customPrompt;
      
      if (!customPrompt) {
        const dataContext = dashboardData ? `
بيانات لوحة التحكم الحالية:
- إجمالي المستخدمين: ${dashboardData.users?.total || 0}
- المستخدمين النشطين اليوم: ${dashboardData.users?.active_today || 0}
- الإيرادات الإجمالية: ${dashboardData.financials?.total_revenue || 0} ريال
- طلبات السحب المعلقة: ${dashboardData.withdrawals?.pending || 0}
- الإعلانات النشطة: ${dashboardData.ads?.active || 0}
- الإعلانات المعلقة: ${dashboardData.ads?.pending || 0}
` : '';

        switch (type) {
          case 'overview':
            prompt = `${dataContext}

أنت مستشار أعمال خبير. قدم تحليلاً شاملاً ومختصراً للوضع الحالي للمنصة مع:
1. نقاط القوة الحالية
2. نقاط تحتاج تحسين
3. توصيات عملية للأسبوع القادم

كن مختصراً ومباشراً.`;
            break;
          
          case 'revenue':
            prompt = `${dataContext}

أنت خبير في زيادة الإيرادات. قدم 5 استراتيجيات عملية لزيادة إيرادات المنصة خلال الشهر القادم.
ركز على:
- جذب معلنين جدد
- زيادة قيمة الإعلان
- تحسين معدل التحويل

قدم أفكار قابلة للتنفيذ فوراً.`;
            break;
          
          case 'engagement':
            prompt = `${dataContext}

أنت خبير في تفاعل المستخدمين. قدم خطة لزيادة تفاعل المستخدمين مع:
1. أفكار لمكافآت يومية
2. تحديات أسبوعية
3. نظام إحالة محسّن
4. إشعارات ذكية

اجعل الأفكار ممتعة وجذابة.`;
            break;
          
          case 'problems':
            prompt = `${dataContext}

أنت مستشار حل مشاكل. بناءً على البيانات:
1. حدد المشاكل المحتملة
2. رتبها حسب الأولوية
3. اقترح حلول فورية
4. حلول طويلة المدى

كن واقعياً ومحدداً.`;
            break;
          
          default:
            prompt = customPrompt;
        }
      }

      const response = await axios.post(`${API_URL}/api/claude-ai/generate-response`, {
        prompt: prompt,
        max_tokens: 1500,
        temperature: 0.7
      }, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      if (response.data.success) {
        setAnalysisResult({
          type,
          content: response.data.response,
          timestamp: new Date().toLocaleString('ar-SA')
        });
      } else {
        toast.error(response.data.error || 'فشل في التحليل');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error(error.response?.data?.detail || 'حدث خطأ في التحليل');
    } finally {
      setLoading(false);
    }
  };

  const analysisTypes = [
    { id: 'overview', name: 'نظرة عامة', icon: BarChart3, color: 'bg-blue-500' },
    { id: 'revenue', name: 'زيادة الإيرادات', icon: TrendingUp, color: 'bg-green-500' },
    { id: 'engagement', name: 'تفاعل المستخدمين', icon: Users, color: 'bg-purple-500' },
    { id: 'problems', name: 'تحليل المشاكل', icon: AlertTriangle, color: 'bg-orange-500' },
  ];

  return (
    <div className="space-y-6">
      {/* AI Status Banner */}
      <Card className={`border-2 ${aiStatus?.enabled ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${aiStatus?.enabled ? 'bg-green-500' : 'bg-orange-500'}`}>
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg">مساعد الذكاء الاصطناعي</h3>
                <p className="text-sm text-gray-600">
                  {aiStatus?.enabled ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="w-4 h-4" /> مفعل ويعمل
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-orange-600">
                      <XCircle className="w-4 h-4" /> غير مفعل - فعّله من إعدادات AI
                    </span>
                  )}
                </p>
              </div>
            </div>
            {aiStatus?.model && (
              <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                {aiStatus.model}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Analysis Buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            تحليل سريع
          </CardTitle>
          <CardDescription>
            اختر نوع التحليل للحصول على رؤى ذكية فورية
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {analysisTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => analyzeWithAI(type.id)}
                disabled={loading || !aiStatus?.enabled}
                className={`p-4 rounded-xl border-2 transition-all hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                  analysisType === type.id && analysisResult
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`w-10 h-10 ${type.color} rounded-lg flex items-center justify-center mx-auto mb-2`}>
                  <type.icon className="w-5 h-5 text-white" />
                </div>
                <p className="text-sm font-medium text-center">{type.name}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Custom Query */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            استشارة مخصصة
          </CardTitle>
          <CardDescription>
            اسأل الذكاء الاصطناعي أي سؤال عن إدارة المنصة
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            placeholder="مثال: كيف أزيد عدد المعلنين؟ أو ما أفضل وقت لإرسال الإشعارات؟"
            rows={3}
            disabled={!aiStatus?.enabled}
          />
          <Button
            onClick={() => analyzeWithAI('custom', customQuery)}
            disabled={loading || !customQuery.trim() || !aiStatus?.enabled}
            className="w-full gap-2"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            احصل على الإجابة
          </Button>
        </CardContent>
      </Card>

      {/* Analysis Result */}
      {analysisResult && (
        <Card className="border-2 border-indigo-200">
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                نتيجة التحليل
              </CardTitle>
              <span className="text-xs text-gray-500">{analysisResult.timestamp}</span>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                {analysisResult.content}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tips Card */}
      <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold mb-2">💡 نصيحة اليوم</h4>
              <p className="text-white/90 text-sm">
                استخدم التحليل الأسبوعي لمتابعة أداء المنصة. الذكاء الاصطناعي يمكنه مساعدتك في اكتشاف الأنماط وتحسين القرارات.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAIAssistant;
