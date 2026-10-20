import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Textarea } from './ui/textarea';
import { 
  Bot, 
  Save, 
  Loader2, 
  CheckCircle, 
  Eye, 
  EyeOff,
  Sparkles,
  Languages,
  FileText,
  Search,
  Send
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AIModelSettings = ({ adminToken }) => {
  const [loading, setLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testPrompt, setTestPrompt] = useState('');
  const [testResponse, setTestResponse] = useState('');
  
  const [settings, setSettings] = useState({
    claude_haiku_enabled: false,
    claude_haiku_enabled_for_all_clients: false,
    anthropic_api_key: ''
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/settings/ai-models`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      setSettings(response.data);
    } catch (error) {
      console.error('Load settings error:', error);
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/settings/ai-models`, settings, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      toast.success('تم حفظ إعدادات الذكاء الاصطناعي بنجاح');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('فشل في حفظ الإعدادات');
    } finally {
      setLoading(false);
    }
  };

  const testAI = async () => {
    if (!testPrompt.trim()) {
      toast.error('يرجى كتابة سؤال أولاً');
      return;
    }
    
    setTestLoading(true);
    setTestResponse('');
    
    try {
      const response = await axios.post(`${API_URL}/api/claude-ai/generate-response`, {
        prompt: testPrompt,
        max_tokens: 500
      }, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      
      if (response.data.success) {
        setTestResponse(response.data.response);
        toast.success('تم توليد الرد بنجاح');
      } else {
        toast.error(response.data.error || 'فشل في توليد الرد');
      }
    } catch (error) {
      console.error('Test error:', error);
      toast.error(error.response?.data?.detail || 'فشل في الاتصال بـ Claude AI');
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Settings Card */}
      <Card className={settings.claude_haiku_enabled ? 'border-2 border-purple-300' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-6 h-6 text-purple-500" />
              Claude Haiku 4.5
            </CardTitle>
            <Switch
              checked={settings.claude_haiku_enabled}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, claude_haiku_enabled: checked }))}
            />
          </div>
          <CardDescription>
            نموذج ذكاء اصطناعي من Anthropic للردود الذكية والتلخيص والترجمة
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings.claude_haiku_enabled && (
            <>
              {/* API Key */}
              <div>
                <label className="text-sm font-medium mb-2 block">Anthropic API Key</label>
                <div className="relative">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    value={settings.anthropic_api_key}
                    onChange={(e) => setSettings(prev => ({ ...prev, anthropic_api_key: e.target.value }))}
                    placeholder="sk-ant-api..."
                    dir="ltr"
                    className="pr-10"
                  />
                  <button 
                    onClick={() => setShowKey(!showKey)} 
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  احصل على المفتاح من: <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:underline">console.anthropic.com</a>
                </p>
              </div>

              {/* Enable for all clients */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-sm">تفعيل لجميع المستخدمين</p>
                  <p className="text-xs text-gray-500">السماح لجميع المستخدمين باستخدام الذكاء الاصطناعي</p>
                </div>
                <Switch
                  checked={settings.claude_haiku_enabled_for_all_clients}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, claude_haiku_enabled_for_all_clients: checked }))}
                />
              </div>

              {/* Save Button */}
              <Button
                onClick={saveSettings}
                disabled={loading}
                className="w-full gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                حفظ الإعدادات
              </Button>
            </>
          )}

          {!settings.claude_haiku_enabled && (
            <div className="text-center py-8 text-gray-500">
              <Bot className="w-16 h-16 mx-auto mb-3 opacity-30" />
              <p>فعّل Claude Haiku للبدء</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Features Card */}
      {settings.claude_haiku_enabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="w-5 h-5 text-yellow-500" />
              الميزات المتاحة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-purple-50 rounded-lg text-center">
                <Bot className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                <p className="text-sm font-medium">الردود الذكية</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg text-center">
                <FileText className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                <p className="text-sm font-medium">تلخيص النصوص</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg text-center">
                <Languages className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p className="text-sm font-medium">الترجمة</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg text-center">
                <Search className="w-8 h-8 mx-auto mb-2 text-orange-500" />
                <p className="text-sm font-medium">تحليل المحتوى</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Card */}
      {settings.claude_haiku_enabled && settings.anthropic_api_key && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle className="w-5 h-5 text-green-500" />
              اختبار الذكاء الاصطناعي
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">اكتب سؤالاً للاختبار</label>
              <Textarea
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                placeholder="مثال: ما هي فوائد مشاهدة الإعلانات؟"
                rows={2}
              />
            </div>
            
            <Button
              onClick={testAI}
              disabled={testLoading}
              variant="outline"
              className="w-full gap-2"
            >
              {testLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              إرسال
            </Button>

            {testResponse && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium mb-2 text-gray-600">الرد:</p>
                <p className="text-sm whitespace-pre-wrap">{testResponse}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AIModelSettings;
