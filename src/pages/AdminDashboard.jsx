import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { Navigate } from 'react-router-dom';

export default function AdminDashboard() {
  const { user, profile, loading: authLoading } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // MASTER KEY: Grant access if email matches or profile has admin (overridden by God Mode)
  const isMasterUser = user?.email === 'hannajohn37@gmail.com';
  const isAdmin = isMasterUser || profile?.is_admin === true || profile?.role === 'admin';
  
  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    
    const fetchUsers = async () => {
      try {
        const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        if (data) setUsers(data);
      } catch (error) {
        console.error("Admin fetch error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [isAdmin]);
  
  if (authLoading) return null;
  if (!isAdmin) return <Navigate to="/dashboard" />;
  
  return (
    <div className="p-8 bg-slate-950 min-h-screen text-white overflow-y-auto">
      <h1 className="text-3xl font-bold mb-6 text-purple-400">Admin Control Center</h1>
      
      {loading ? (
        <div>Loading users...</div>
      ) : (
        <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-4">Email</th>
                <th className="pb-4">Role</th>
                <th className="pb-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-slate-800/50">
                  <td className="py-4 pr-4">{u.email}</td>
                  <td className="py-4 pr-4">{u.role || 'user'}</td>
                  <td className="py-4">
                    <span className={`px-2 py-1 rounded text-xs ${u.is_pro ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-700 text-slate-300'}`}>
                      {u.is_pro ? 'PRO' : 'FREE'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
