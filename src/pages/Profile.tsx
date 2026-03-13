import React from 'react';
import { auth, logout } from '../firebase';
import { LogOut, User as UserIcon, Mail, Shield, Settings } from 'lucide-react';

export default function Profile() {
  const user = auth.currentUser;

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center py-6">
        <div className="relative mb-4">
          <div className="w-24 h-24 rounded-full bg-[#895af6]/10 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
            {user.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-12 h-12 text-[#895af6]" />
            )}
          </div>
        </div>
        <h2 className="text-2xl font-bold text-slate-900">{user.displayName || 'Usuario Coco'}</h2>
        <p className="text-slate-500 text-sm">{user.email}</p>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
        <div className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl transition-colors cursor-pointer">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-slate-400" />
            <span className="font-medium text-slate-700">Email Notifications</span>
          </div>
          <div className="w-10 h-6 bg-emerald-500 rounded-full relative">
            <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
          </div>
        </div>
        <div className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl transition-colors cursor-pointer">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-slate-400" />
            <span className="font-medium text-slate-700">Privacy Settings</span>
          </div>
        </div>
        <div className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl transition-colors cursor-pointer">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-slate-400" />
            <span className="font-medium text-slate-700">App Preferences</span>
          </div>
        </div>
      </div>

      <button
        onClick={logout}
        className="w-full py-4 bg-red-50 text-red-500 font-bold rounded-2xl flex items-center justify-center gap-3 hover:bg-red-100 transition-colors"
      >
        <LogOut className="w-5 h-5" />
        Cerrar Sesión
      </button>
    </div>
  );
}
