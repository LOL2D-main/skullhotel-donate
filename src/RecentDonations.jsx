import React, { useState, useEffect } from 'react';
import './RecentDonations.css';

export default function RecentDonations() {
  const [donations, setDonations] = useState([]);

  useEffect(() => {
    const fetchDonations = async () => {
      try {
        const response = await fetch('/api/recent-transactions');
        const data = await response.json();
        if (data.success && data.transactions) {
          setDonations(data.transactions);
        }
      } catch (err) {
        console.error("Failed to fetch recent donations", err);
      }
    };

    fetchDonations();
    const interval = setInterval(fetchDonations, 15000); // Lặp lại mỗi 15 giây
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="recent-donations-panel">
      <div className="recent-header">
        <h3>GIAO DỊCH GẦN NHẤT</h3>
        <span className="live-indicator">● LIVE</span>
      </div>
      <div className="recent-list">
        {donations.length === 0 ? (
          <p className="no-data">Đang kết nối ngân hàng...</p>
        ) : (
          donations.map((d, index) => (
            <div key={d.id} className="donation-item" style={{ animationDelay: `${index * 0.1}s` }}>
              <div className="donator-avatar">💀</div>
              <div className="donator-info">
                <span className="donator-name">&lt; {d.name} &gt;</span>
                <span className="donator-action"> vừa quyên góp </span>
                <span className="donator-amount">{d.amount.toLocaleString('vi-VN')} VNĐ</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
