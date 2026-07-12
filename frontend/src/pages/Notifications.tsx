import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { AlertTriangle, Bell, Clock3, MapPin, User2 } from 'lucide-react';

interface NotificationItem {
  id: string;
  driver_id: string;
  driver_name: string;
  tag: '🔴' | '🟡';
  description: string;
  location: string;
  created_at: string;
}



export const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await api.get<NotificationItem[]>('/notifications');
        setNotifications(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load notifications.');
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-brand-500" />
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100">Notifications</h1>
        </div>
        <p className="text-xs text-neutral-400">Driver-submitted red and yellow tag updates with location context.</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-800 bg-red-950/40 text-red-200 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-40 rounded-2xl border border-neutral-800 bg-neutral-900/50" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="glass rounded-2xl border border-neutral-800 p-8 text-center text-neutral-400">
          No notifications have been submitted yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {notifications.map((notification) => (
            <div key={notification.id} className="glass rounded-2xl border border-neutral-800 p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
                    <User2 className="w-3.5 h-3.5" />
                    <span className="font-semibold text-neutral-200">{notification.driver_name}</span>
                    <span className="text-neutral-600">•</span>
                    <span className="font-mono text-neutral-500">{notification.driver_id}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                    <Clock3 className="w-3 h-3" />
                    {new Date(notification.created_at).toLocaleString()}
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${tagStyles[notification.tag]}`}>
                  {notification.tag} 
                </span>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 text-sm text-neutral-200 leading-relaxed">
                  {notification.description}
                </div>
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                  <MapPin className="w-4 h-4 text-brand-500" />
                  <span className="uppercase tracking-wider text-[10px] font-bold">Location</span>
                  <span className="text-neutral-200 font-medium normal-case tracking-normal">{notification.location}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
