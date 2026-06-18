import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import OccultSpinner from './components/OccultSpinner'
import RecentDonations from './RecentDonations'
import { SuccessIcon, FailIcon } from './components/StatusIcons'

function App() {
  const [username, setUsername] = useState('')
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState('idle') // 'idle', 'processing', 'success', 'fail'
  const [qrCode, setQrCode] = useState(null)
  const [expectedContent, setExpectedContent] = useState('')
  const [uniqueCode, setUniqueCode] = useState('')
  const [timeLeft, setTimeLeft] = useState(300) // 300 giây = 5 phút

  const SEPAY_BANK = import.meta.env.VITE_BANK_ID || 'MB'
  const SEPAY_ACCOUNT_NAME = import.meta.env.VITE_ACCOUNT_NAME || 'NGUYEN NHAT THIEN'
  const SEPAY_ACCOUNT_NUMBER = import.meta.env.VITE_ACCOUNT_NO || '0792362190'

  const pollingRef = useRef(null)
  const timerRef = useRef(null)
  const statusRef = useRef('idle')

  // Keep statusRef in sync so interval callbacks always see latest status
  useEffect(() => {
    statusRef.current = status
  }, [status])

  const removeVietnameseTones = (str) => {
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    return str;
  }

  /**
   * Generate a 6-character alphanumeric code.
   * 6 chars = 2.1 billion combos, virtually no collision.
   */
  const generateUniqueCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  const handleDownloadQR = () => {
    window.location.href = `/api/download-qr?url=${encodeURIComponent(qrCode)}`;
  }

  const handleDonate = () => {
    if (!amount || isNaN(amount) || parseInt(amount) <= 0 || !username.trim()) return
    
    // Clean username: remove Vietnamese tones and special chars
    let cleanUsername = removeVietnameseTones(username.trim());
    cleanUsername = cleanUsername.replace(/[^a-zA-Z0-9\s]/g, '').toUpperCase();
    
    const code = generateUniqueCode()
    // Content format: "SH [CODE] donate SkullHotel [NAME]"
    // "SH" prefix identifies this as a SkullHotel transaction
    // [CODE] is right at the front — banks NEVER cut the beginning
    const content = `DH ${code} donate SkullHotel ${cleanUsername}`
    
    setUniqueCode(code)
    setExpectedContent(content)
    setTimeLeft(300)

    const qrUrl = `https://img.vietqr.io/image/${SEPAY_BANK}-${SEPAY_ACCOUNT_NUMBER}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(content)}&accountName=${encodeURIComponent(SEPAY_ACCOUNT_NAME)}`
    
    setQrCode(qrUrl)
    setStatus('processing')
  }

  const cancelDonate = useCallback(() => {
    setStatus('idle')
    setQrCode(null)
    setUniqueCode('')
    setExpectedContent('')
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // ============================================================
  // EFFECT 1: Countdown timer (independent — no polling dependency)
  // ============================================================
  useEffect(() => {
    if (status !== 'processing') return

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          timerRef.current = null
          // Only set fail if still processing (not already success)
          if (statusRef.current === 'processing') {
            setStatus('fail')
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [status])

  // ============================================================
  // EFFECT 2: Polling — check transaction every 4 seconds
  // Dependency: only [status, uniqueCode, amount]
  // Does NOT depend on timeLeft — this was the critical bug before
  // ============================================================
  useEffect(() => {
    if (status !== 'processing' || !uniqueCode) return

    const checkTransaction = async () => {
      // Guard: don't check if no longer processing
      if (statusRef.current !== 'processing') return

      try {
        const response = await fetch(
          `/api/check-transaction?uniqueCode=${encodeURIComponent(uniqueCode)}&amount=${amount}&_t=${Date.now()}`
        )
        
        if (!response.ok) return

        const data = await response.json()
        
        // Guard again: status might have changed while awaiting
        if (statusRef.current !== 'processing') return

        if (data.success) {
          setStatus('success')
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
        }
      } catch (error) {
        console.error("Lỗi khi kiểm tra giao dịch:", error)
      }
    }

    // Check immediately on first mount (don't wait 4 seconds)
    checkTransaction()

    // Then poll every 4 seconds
    pollingRef.current = setInterval(checkTransaction, 4000)

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [status, uniqueCode, amount])

  return (
    <div className="donate-overlay">
      <div className="donate-container">
        <div key={status} className="state-transition">
          {status === 'idle' && (
            <>
            <h1 className="donate-title">QUYÊN GÓP</h1>
            <p className="donate-subtitle">Giúp duy trì và vận hành Skull Hotel</p>
            
            <div className="input-group">
              <label className="input-label">Tên của bạn</label>
              <input 
                type="text" 
                className="donate-input" 
                placeholder="Ví dụ: Nguyễn Nhật Thiện" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Số tiền (VNĐ)</label>
              <input 
                type="text" 
                className="donate-input" 
                placeholder="Nhập số tiền..." 
                value={amount ? parseInt(amount, 10).toLocaleString('vi-VN') : ''}
                onChange={(e) => {
                  const rawValue = e.target.value.replace(/\D/g, '');
                  setAmount(rawValue);
                }}
              />
            </div>
            
            <button 
              className="donate-btn" 
              onClick={handleDonate}
              disabled={!amount || parseInt(amount) <= 0 || !username.trim()}
            >
              TIẾN HÀNH DONATE
            </button>
          </>
        )}

        {status === 'processing' && (
          <div className="donate-qr-section">
            <h2 className="donate-title">ĐANG XỬ LÝ...</h2>
            <p className="donate-subtitle">Vui lòng quét mã QR dưới đây để thanh toán</p>
            
            <div className={`countdown-timer${timeLeft <= 30 ? ' hurry' : ''}`}>
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </div>
            
            <div className="donate-qr-wrapper" style={{ position: 'relative' }}>
              <img src={qrCode} alt="QR Code" className="donate-qr-image" />
              <div className="qr-scan-line"></div>
              
              <button 
                onClick={handleDownloadQR} 
                title="Lưu mã QR"
                className="btn-download-icon"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </button>
            </div>
            
            <div className="donate-bank-info" style={{ marginTop: '30px' }}>
              <div className="donate-info-row">
                <span className="donate-info-label">Số tiền:</span>
                <span className="donate-info-val">{parseInt(amount).toLocaleString('vi-VN')} VNĐ</span>
                <button className="donate-copy-btn" onClick={() => navigator.clipboard.writeText(amount)}>Copy</button>
              </div>
              <div className="donate-info-row">
                <span className="donate-info-label">Nội dung:</span>
                <span className="donate-info-val content-val">{expectedContent}</span>
                <button className="donate-copy-btn" onClick={() => navigator.clipboard.writeText(expectedContent)}>Copy</button>
              </div>
            </div>
            
            <div className="donate-status-wrapper" style={{ marginTop: '20px' }}>
              <OccultSpinner size={50} />
              <p className="donate-status-message">Hệ thống đang kiểm tra giao dịch liên tục...</p>
            </div>

            <button className="donate-cancel-btn" onClick={cancelDonate} style={{ marginTop: '20px' }}>Hủy giao dịch</button>
          </div>
        )}

        {status === 'success' && (
          <div className="donate-status-wrapper" style={{ padding: '50px 0' }}>
            <SuccessIcon size={80} />
            <h2 className="donate-title" style={{ marginTop: '20px', color: '#2e8b2e', textShadow: '0 0 10px rgba(46,139,46,0.4)' }}>
              GIAO DỊCH THÀNH CÔNG
            </h2>
            <p className="donate-status-message">Cảm ơn {username} đã quyên góp để duy trì Khách sạn đầu lâu SkullHotel.</p>
            <button className="donate-btn" style={{ marginTop: '20px', borderColor: '#2e8b2e', color: '#2e8b2e' }} onClick={cancelDonate}>
              QUAY LẠI
            </button>
          </div>
        )}

        {status === 'fail' && (
          <div className="donate-status-wrapper" style={{ padding: '50px 0' }}>
            <FailIcon size={80} />
            <h2 className="donate-title" style={{ marginTop: '20px' }}>
              GIAO DỊCH THẤT BẠI HOẶC QUÁ HẠN
            </h2>
            <p className="donate-status-message">Đã quá 5 phút nhưng không tìm thấy giao dịch. Vui lòng tạo mã QR mới nếu bạn vẫn muốn Donate.</p>
            <button className="donate-btn" style={{ marginTop: '20px' }} onClick={cancelDonate}>
              TẠO MÃ QR MỚI
            </button>
          </div>
        )}
        </div>
      </div>
      <RecentDonations />
    </div>
  )
}

export default App
