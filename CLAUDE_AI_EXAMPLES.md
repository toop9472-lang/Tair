# 💻 أمثلة استخدام Claude Haiku 4.5

## 1. استخدام الخدمة في Python Backend

### التوليد الأساسي للردود

```python
from services.claude_ai_service import get_claude_service
import asyncio

async def generate_ad_description():
    """Generate an ad description using Claude"""
    claude = get_claude_service()
    
    result = await claude.generate_response(
        prompt="اكتب وصفاً جذاباً لمنتج فني جديد",
        system_message="أنت كاتب نصوص إعلانية محترف",
        temperature=0.8
    )
    
    if result['success']:
        print(f"✅ وصف المنتج:\n{result['response']}")
    else:
        print(f"❌ خطأ: {result['error']}")

# استخدم asyncio.run() إذا لم تكن في دالة async
asyncio.run(generate_ad_description())
```

### التلخيص الذكي

```python
async def summarize_ad_content():
    """Summarize long ad content"""
    claude = get_claude_service()
    
    long_text = """
    هذا إعلان طويل جداً عن منتج جديد يوفر حلاً متكاملاً
    للعديد من المشاكل التي يواجهها المستخدمون يومياً...
    """
    
    result = await claude.generate_summary(long_text, language='ar')
    
    if result['success']:
        print(f"📄 الملخص:\n{result['response']}")
```

### الترجمة الآلية

```python
async def translate_ad():
    """Translate ad content"""
    claude = get_claude_service()
    
    english_text = "Discover our new amazing product"
    
    result = await claude.translate_text(english_text, target_language='ar')
    
    if result['success']:
        print(f"🌐 الترجمة: {result['response']}")
```

### تحليل محتوى الإعلان

```python
async def validate_ad_content():
    """Validate ad content for safety and compliance"""
    claude = get_claude_service()
    
    ad_content = """
    منتج ثوري يغير الحياة - خصم 99% لفترة محدودة
    """
    
    result = await claude.analyze_content(ad_content)
    
    if result['success']:
        print(f"🔍 تحليل المحتوى:\n{result['response']}")
```

---

## 2. استخدام الـ APIs من Frontend

### React Component مثال

```javascript
import React, { useState } from 'react';
import axios from 'axios';

function ClaudeAIComponent() {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const API_URL = process.env.REACT_APP_BACKEND_URL;
  
  const generateResponse = async () => {
    try {
      setLoading(true);
      setError('');
      
      const token = localStorage.getItem('admin_token');
      
      const result = await axios.post(
        `${API_URL}/api/claude-ai/generate-response`,
        {
          prompt: prompt,
          system_message: 'أنت مساعد ذكي متخصص',
          temperature: 0.7,
          max_tokens: 1024
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (result.data.success) {
        setResponse(result.data.response);
      } else {
        setError(result.data.error || 'حدث خطأ');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'فشل الاتصال');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="space-y-4">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="أدخل سؤالك هنا..."
        className="w-full p-3 border rounded"
      />
      
      <button
        onClick={generateResponse}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        {loading ? 'جاري المعالجة...' : 'توليد رد'}
      </button>
      
      {error && <div className="text-red-600">{error}</div>}
      
      {response && (
        <div className="p-4 bg-green-50 border border-green-200 rounded">
          <h3 className="font-bold mb-2">الرد:</h3>
          <p>{response}</p>
        </div>
      )}
    </div>
  );
}

export default ClaudeAIComponent;
```

### Summarizer Component

```javascript
async function summarizeText(text, token) {
  const response = await fetch(
    `${process.env.REACT_APP_BACKEND_URL}/api/claude-ai/summarize`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        language: 'ar'
      })
    }
  );
  
  return response.json();
}
```

---

## 3. استخدام في نماذج أخرى

### في Ad Validation

```python
from routes.ad_routes import router
from services.claude_ai_service import get_claude_service

@router.post("/validate-with-claude")
async def validate_ad_with_claude(
    ad_content: str,
    user_id: str = Depends(get_current_user_id)
):
    """Validate ad content using Claude AI"""
    
    db = get_db()
    admin = await db.admins.find_one({'id': user_id})
    if not admin:
        raise HTTPException(status_code=403, detail="Only admins can validate")
    
    claude = get_claude_service()
    
    # Get AI settings
    ai_settings = await db.settings.find_one({'type': 'ai_models'})
    if not ai_settings or not ai_settings.get('claude_haiku_enabled'):
        raise HTTPException(status_code=403, detail="Claude AI not enabled")
    
    result = await claude.analyze_content(ad_content)
    
    # Store validation result
    if result['success']:
        await db.ad_validations.insert_one({
            'ad_id': ad_id,
            'validation_result': result['response'],
            'timestamp': datetime.utcnow()
        })
    
    return result
```

### في Notification Service

```python
async def generate_personalized_notification(user_data, points_earned):
    """Generate personalized notification using Claude"""
    from services.claude_ai_service import get_claude_service
    
    claude = get_claude_service()
    
    prompt = f"""
    اكتب رسالة تهنئة شخصية قصيرة لمستخدم:
    - الاسم: {user_data['name']}
    - النقاط المكتسبة: {points_earned}
    - المستوى: {user_data['level']}
    """
    
    result = await claude.generate_response(
        prompt=prompt,
        system_message="أنت كاتب رسائل تشجيع ذكي",
        temperature=0.8,
        max_tokens=100
    )
    
    return result['response'] if result['success'] else None
```

---

## 4. حالات الاستخدام الموصى بها

### ✅ الأفضل للاستخدام

```python
# تلخيص طويل → قصير
async def create_ad_summary(full_description):
    return await claude.generate_summary(full_description)

# ترجمة محتوى
async def translate_to_english(arabic_text):
    return await claude.translate_text(arabic_text, 'en')

# توليد نصوص إبداعية
async def generate_catchy_title():
    return await claude.generate_response(
        "اكتب عنواناً جذاباً لإعلان منتج فني",
        temperature=0.9
    )

# فحص سلامة المحتوى
async def check_ad_safety(content):
    return await claude.analyze_content(content)
```

### ❌ غير مناسب للاستخدام

```python
# لا تستخدم Claude لـ:
# - معالجة الأداء الحرجة (ليس سريع جداً)
# - البيانات الكبيرة جداً (استخدم نماذج أخرى)
# - القرارات المالية الحساسة (يحتاج تحقق بشري)
# - معالجة الصور (استخدم نماذج متخصصة)
```

---

## 5. معالجة الأخطاء

### نمط معالجة شامل

```python
async def safe_claude_call(prompt, **kwargs):
    """Safe wrapper for Claude calls"""
    try:
        claude = get_claude_service()
        
        # Check if configured
        if not claude.is_configured():
            return {
                'success': False,
                'error': 'Claude AI is not configured',
                'fallback': 'Using default response'
            }
        
        # Make the call
        result = await claude.generate_response(prompt, **kwargs)
        
        if result['success']:
            return result
        else:
            # Log error
            logger.error(f"Claude error: {result['error']}")
            return {
                'success': False,
                'error': 'Claude service error',
                'fallback': 'Using cached response'
            }
    
    except Exception as e:
        logger.exception(f"Unexpected error: {e}")
        return {
            'success': False,
            'error': str(e),
            'fallback': 'Using default response'
        }
```

---

## 6. أفضل الممارسات

### 1. استخدام Temperature المناسبة
```python
# للمهام الدقيقة: 0.3-0.5
await claude.generate_response(prompt, temperature=0.3)

# للمهام المتوازنة: 0.5-0.7
await claude.generate_response(prompt, temperature=0.7)

# للمهام الإبداعية: 0.8-1.0
await claude.generate_response(prompt, temperature=0.9)
```

### 2. تحديد Max Tokens بحكمة
```python
# للملخصات: 200-500
await claude.generate_summary(text, max_tokens=300)

# للردود الكاملة: 1000-2000
await claude.generate_response(prompt, max_tokens=1500)

# للتحليل التفصيلي: 2000+
await claude.analyze_content(content, max_tokens=3000)
```

### 3. الرسائل الواضحة
```python
# ❌ سيء
prompt = "اكتب شيء"

# ✅ جيد
prompt = """
اكتب وصفاً مختصراً (50 كلمة) لمنتج سماعات بلوتوث جديدة.
يجب أن يكون الوصف:
- جذاباً وموجزاً
- باللغة العربية الفصحى
- يركز على الميزات الرئيسية
"""
```

---

## 7. مراقبة الاستخدام

### تسجيل الاستخدام

```python
async def log_claude_usage(user_id, prompt, response, tokens_used):
    """Log Claude AI usage for analytics"""
    db = get_db()
    
    await db.claude_usage.insert_one({
        'user_id': user_id,
        'prompt_length': len(prompt),
        'response_length': len(response),
        'tokens_used': tokens_used,
        'timestamp': datetime.utcnow()
    })
```

### الإحصائيات

```python
async def get_claude_stats(days=30):
    """Get Claude AI usage statistics"""
    db = get_db()
    
    stats = await db.claude_usage.aggregate([
        {
            '$match': {
                'timestamp': {
                    '$gte': datetime.utcnow() - timedelta(days=days)
                }
            }
        },
        {
            '$group': {
                '_id': None,
                'total_calls': {'$sum': 1},
                'total_tokens': {'$sum': '$tokens_used'},
                'avg_response_length': {'$avg': '$response_length'}
            }
        }
    ]).to_list(1)
    
    return stats[0] if stats else {}
```

---

**آخر تحديث:** يناير 2026
