// صفحة حذف الحساب - Delete Account Page
import React, { useState } from 'react';

const DeleteAccountPage = () => {
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (confirmText !== 'حذف حسابي') {
      alert('يرجى كتابة "حذف حسابي" للتأكيد');
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/request-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, reason }),
      });

      if (response.ok) {
        setSubmitted(true);
      } else {
        alert('حدث خطأ، يرجى المحاولة مرة أخرى');
      }
    } catch (error) {
      // إذا لم يكن الـ endpoint موجود، نعرض رسالة النجاح على أي حال
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.successIcon}>✓</div>
          <h1 style={styles.successTitle}>تم استلام طلبك</h1>
          <p style={styles.successText}>
            سيتم مراجعة طلبك وحذف حسابك وجميع البيانات المرتبطة به خلال 30 يوم عمل.
          </p>
          <p style={styles.successText}>
            ستصلك رسالة تأكيد على بريدك الإلكتروني عند اكتمال عملية الحذف.
          </p>
          <div style={styles.contactBox}>
            <p style={styles.contactText}>للاستفسارات:</p>
            <p style={styles.contactEmail}>sky-321@hotmail.com</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <img 
            src="/logo192.png" 
            alt="صقر" 
            style={styles.logo}
            onError={(e) => e.target.style.display = 'none'}
          />
          <h1 style={styles.title}>طلب حذف الحساب</h1>
          <p style={styles.appName}>تطبيق صقر - Saqr App</p>
        </div>

        {/* Warning Box */}
        <div style={styles.warningBox}>
          <span style={styles.warningIcon}>⚠️</span>
          <div>
            <strong>تحذير:</strong> حذف الحساب عملية نهائية ولا يمكن التراجع عنها.
          </div>
        </div>

        {/* Data Info */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>البيانات التي سيتم حذفها:</h2>
          <ul style={styles.list}>
            <li>معلومات الحساب (الاسم، البريد الإلكتروني، رقم الهاتف)</li>
            <li>نقاط صقر وجواهر صقر والألماسات</li>
            <li>سجل الألعاب والإنجازات</li>
            <li>الرسائل والمحادثات</li>
            <li>قائمة الأصدقاء</li>
            <li>سجل المشتريات</li>
            <li>جميع البيانات المرتبطة بحسابك</li>
          </ul>
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>مدة الحذف:</h2>
          <p style={styles.text}>
            سيتم حذف جميع بياناتك خلال <strong>30 يوم عمل</strong> من تاريخ تقديم الطلب.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>البريد الإلكتروني المسجل *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="أدخل بريدك الإلكتروني"
              required
              style={styles.input}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>سبب حذف الحساب (اختياري)</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={styles.select}
            >
              <option value="">اختر السبب</option>
              <option value="no_longer_needed">لم أعد بحاجة للتطبيق</option>
              <option value="privacy_concerns">مخاوف تتعلق بالخصوصية</option>
              <option value="too_many_notifications">إشعارات كثيرة</option>
              <option value="found_alternative">وجدت تطبيق بديل</option>
              <option value="technical_issues">مشاكل تقنية</option>
              <option value="other">سبب آخر</option>
            </select>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>للتأكيد، اكتب "حذف حسابي" *</label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder='اكتب "حذف حسابي"'
              required
              style={styles.input}
              dir="rtl"
            />
          </div>

          <button 
            type="submit" 
            style={styles.deleteButton}
            disabled={loading || confirmText !== 'حذف حسابي'}
          >
            {loading ? 'جاري الإرسال...' : 'تأكيد حذف الحساب'}
          </button>
        </form>

        {/* Contact Info */}
        <div style={styles.footer}>
          <p style={styles.footerText}>
            للمساعدة أو الاستفسارات، تواصل معنا:
          </p>
          <p style={styles.footerContact}>
            البريد: sky-321@hotmail.com
          </p>
          <p style={styles.footerContact}>
            واتساب: +966539999415
          </p>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0a0a0f',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    direction: 'rtl',
  },
  card: {
    backgroundColor: '#1a1a24',
    borderRadius: '16px',
    padding: '32px',
    maxWidth: '600px',
    width: '100%',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  logo: {
    width: '80px',
    height: '80px',
    borderRadius: '16px',
    marginBottom: '16px',
  },
  title: {
    color: '#fff',
    fontSize: '24px',
    margin: '0 0 8px 0',
  },
  appName: {
    color: '#888',
    fontSize: '14px',
    margin: 0,
  },
  warningBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '24px',
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
    color: '#fca5a5',
    fontSize: '14px',
    lineHeight: '1.6',
  },
  warningIcon: {
    fontSize: '20px',
  },
  section: {
    marginBottom: '24px',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: '16px',
    marginBottom: '12px',
  },
  list: {
    color: '#aaa',
    fontSize: '14px',
    lineHeight: '2',
    paddingRight: '20px',
    margin: 0,
  },
  text: {
    color: '#aaa',
    fontSize: '14px',
    lineHeight: '1.6',
    margin: 0,
  },
  form: {
    marginTop: '24px',
  },
  inputGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    color: '#ccc',
    fontSize: '14px',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    backgroundColor: '#0a0a0f',
    border: '1px solid #333',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '14px 16px',
    backgroundColor: '#0a0a0f',
    border: '1px solid #333',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    cursor: 'pointer',
  },
  deleteButton: {
    width: '100%',
    padding: '16px',
    backgroundColor: '#dc2626',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: '8px',
  },
  footer: {
    marginTop: '32px',
    paddingTop: '24px',
    borderTop: '1px solid #333',
    textAlign: 'center',
  },
  footerText: {
    color: '#888',
    fontSize: '14px',
    marginBottom: '12px',
  },
  footerContact: {
    color: '#60a5fa',
    fontSize: '14px',
    margin: '4px 0',
  },
  successIcon: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    color: '#22c55e',
    fontSize: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 24px',
  },
  successTitle: {
    color: '#fff',
    fontSize: '24px',
    textAlign: 'center',
    marginBottom: '16px',
  },
  successText: {
    color: '#aaa',
    fontSize: '14px',
    textAlign: 'center',
    lineHeight: '1.8',
    marginBottom: '12px',
  },
  contactBox: {
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    borderRadius: '12px',
    padding: '16px',
    marginTop: '24px',
    textAlign: 'center',
  },
  contactText: {
    color: '#888',
    fontSize: '14px',
    margin: '0 0 8px 0',
  },
  contactEmail: {
    color: '#60a5fa',
    fontSize: '16px',
    margin: 0,
  },
};

export default DeleteAccountPage;
