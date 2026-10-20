import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { 
  Gift, Play, Eye, EyeOff, Save, RefreshCw, 
  Tv, Trophy, Clock, Target, DollarSign
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const RewardedAdsSettings = () => {
  const [settings, setSettings] = useState({
    admob_enabled: false,
    admob_app_id: '',
    admob_rewarded_unit_id: '',
    unity_enabled: false,
    unity_game_id: '',
    unity_rewarded_placement_id: '',
    facebook_enabled: false,
    facebook_app_id: '',
    facebook_rewarded_placement_id: '',
    applovin_enabled: false,
    applovin_sdk_key: '',
    applovin_rewarded_unit_id: '',
    personal_ads_enabled: true,
    personal_ads_priority: 1,
    points_per_rewarded_ad: 5,
    daily_rewarded_limit: 50,
    cooldown_seconds: 30
  });

  const [showKeys, setShowKeys] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await axios.get(`${API}/api/rewarded-ads/settings`, {
        headers: getAuthHeaders()
      });
      setSettings(prev => ({ ...prev, ...res.data }));
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      await axios.put(`${API}/api/rewarded-ads/settings`, settings, {
        headers: getAuthHeaders()
      });
      toast.success('تم حفظ إعدادات الإعلانات المكافئة');
    } catch (error) {
      toast.error('فشل حفظ الإعدادات');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleShowKey = (key) => setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));

  const adNetworks = [
    {
      id: 'admob',
      name: 'Google AdMob',
      icon: '🎯',
      color: 'green',
      fields: [
        { key: 'admob_app_id', label: 'App ID', placeholder: 'ca-app-pub-xxxxx' },
        { key: 'admob_rewarded_unit_id', label: 'Rewarded Unit ID', placeholder: 'ca-app-pub-xxxxx/xxxxx' }
      ],
      helpUrl: 'https://admob.google.com'
    },
    {
      id: 'unity',
      name: 'Unity Ads',
      icon: '🎮',
      color: 'purple',
      fields: [
        { key: 'unity_game_id', label: 'Game ID', placeholder: '1234567' },
        { key: 'unity_rewarded_placement_id', label: 'Placement ID', placeholder: 'rewardedVideo' }
      ],
      helpUrl: 'https://dashboard.unity3d.com'
    },
    {
      id: 'facebook',
      name: 'Facebook Audience',
      icon: '📘',
      color: 'blue',
      fields: [
        { key: 'facebook_app_id', label: 'App ID', placeholder: '1234567890' },
        { key: 'facebook_rewarded_placement_id', label: 'Placement ID', placeholder: 'YOUR_PLACEMENT_ID' }
      ],
      helpUrl: 'https://business.facebook.com'
    },
    {
      id: 'applovin',
      name: 'AppLovin MAX',
      icon: '🦁',
      color: 'orange',
      fields: [
        { key: 'applovin_sdk_key', label: 'SDK Key', placeholder: 'xxxxx' },
        { key: 'applovin_rewarded_unit_id', label: 'Ad Unit ID', placeholder: 'xxxxx' }
      ],
      helpUrl: 'https://dash.applovin.com'
    }
  ];

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Gift className="w-7 h-7 text-yellow-500" />
            الإعلانات المكافئة (Rewarded Ads)
          </h2>
          <p className="text-gray-500 mt-1">إدارة شبكات الإعلانات وإعدادات المكافآت</p>
        </div>
      </div>

      {/* Reward Settings */}
      <Card className="border-2 border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-600" />
            إعدادات المكافآت
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>النقاط لكل إعلان</Label>
              <Input
                type="number"
                value={settings.points_per_rewarded_ad}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  points_per_rewarded_ad: parseInt(e.target.value) || 5 
                }))}
                min="1"
                max="100"
              />
            </div>
            <div>
              <Label>الحد اليومي (إعلان)</Label>
              <Input
                type="number"
                value={settings.daily_rewarded_limit}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  daily_rewarded_limit: parseInt(e.target.value) || 50 
                }))}
                min="1"
                max="200"
              />
            </div>
            <div>
              <Label>فترة الانتظار (ثانية)</Label>
              <Input
                type="number"
                value={settings.cooldown_seconds}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  cooldown_seconds: parseInt(e.target.value) || 30 
                }))}
                min="0"
                max="300"
              />
            </div>
          </div>
          <div className="mt-4 p-3 bg-white rounded-lg border">
            <p className="text-sm text-gray-600">
              💰 الربح اليومي المحتمل للمستخدم: <strong className="text-green-600">
                {settings.points_per_rewarded_ad * settings.daily_rewarded_limit} نقطة
              </strong>
              {' '}= <strong className="text-green-600">
                ${((settings.points_per_rewarded_ad * settings.daily_rewarded_limit) / 500).toFixed(2)}
              </strong>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Personal Ads */}
      <Card className={`border-2 ${settings.personal_ads_enabled ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200'}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-600" />
              الإعلانات الشخصية (المعلنين)
            </CardTitle>
            <Switch
              checked={settings.personal_ads_enabled}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, personal_ads_enabled: checked }))}
            />
          </div>
          <CardDescription>
            إعلانات المعلنين الذين يدفعون اشتراك شهري - تظهر بأولوية عالية
          </CardDescription>
        </CardHeader>
        {settings.personal_ads_enabled && (
          <CardContent>
            <div className="flex items-center gap-4 p-3 bg-white rounded-lg">
              <DollarSign className="w-8 h-8 text-green-500" />
              <div>
                <p className="font-medium">الأولوية القصوى</p>
                <p className="text-sm text-gray-500">الإعلانات الشخصية تظهر أولاً قبل شبكات الإعلانات الخارجية</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Ad Networks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {adNetworks.map((network) => (
          <Card 
            key={network.id}
            className={`border-2 transition-all ${
              settings[`${network.id}_enabled`] 
                ? `border-${network.color}-200 bg-${network.color}-50` 
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <span className="text-2xl">{network.icon}</span>
                  {network.name}
                </CardTitle>
                <Switch
                  checked={settings[`${network.id}_enabled`]}
                  onCheckedChange={(checked) => setSettings(prev => ({ 
                    ...prev, 
                    [`${network.id}_enabled`]: checked 
                  }))}
                />
              </div>
            </CardHeader>
            
            {settings[`${network.id}_enabled`] && (
              <CardContent className="space-y-3">
                {network.fields.map((field) => (
                  <div key={field.key}>
                    <Label className="text-sm">{field.label}</Label>
                    <div className="relative">
                      <Input
                        type={showKeys[field.key] ? 'text' : 'password'}
                        value={settings[field.key]}
                        onChange={(e) => setSettings(prev => ({ 
                          ...prev, 
                          [field.key]: e.target.value 
                        }))}
                        placeholder={field.placeholder}
                        className="pl-10"
                        dir="ltr"
                      />
                      <button 
                        onClick={() => toggleShowKey(field.key)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      >
                        {showKeys[field.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                ))}
                <a 
                  href={network.helpUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  احصل على المفاتيح من {network.name} ←
                </a>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Save Button */}
      <Button 
        onClick={saveSettings} 
        disabled={isSaving}
        className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
        size="lg"
      >
        {isSaving ? (
          <RefreshCw className="w-5 h-5 animate-spin ml-2" />
        ) : (
          <Save className="w-5 h-5 ml-2" />
        )}
        حفظ إعدادات الإعلانات المكافئة
      </Button>

      {/* Info Box */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <h4 className="font-semibold text-blue-800 mb-2">💡 كيف تعمل الإعلانات المكافئة؟</h4>
          <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
            <li>المستخدم يضغط على زر مشاهدة الإعلان</li>
            <li>يشاهد إعلان فيديو كامل (30 ثانية تقريباً)</li>
            <li>يحصل على النقاط المحددة كمكافأة</li>
            <li>الإعلانات الشخصية لها الأولوية ← ثم شبكات الإعلانات</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
};

export default RewardedAdsSettings;
