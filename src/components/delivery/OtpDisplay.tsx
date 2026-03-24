import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Shield, CheckCircle, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface OtpDisplayProps {
  orderId: string;
}

export default function OtpDisplay({ orderId }: OtpDisplayProps) {
  const [otpData, setOtpData] = useState<{ otp_code: string; is_verified: boolean; verified_at: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOtp();

    const channel = supabase
      .channel(`otp-${orderId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_otps', filter: `order_id=eq.${orderId}` }, (payload) => {
        const data = payload.new as any;
        if (data) setOtpData({ otp_code: data.otp_code, is_verified: data.is_verified, verified_at: data.verified_at });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orderId]);

  const fetchOtp = async () => {
    const { data } = await supabase
      .from('delivery_otps')
      .select('otp_code, is_verified, verified_at')
      .eq('order_id', orderId)
      .single();

    if (data) setOtpData(data);
    setLoading(false);
  };

  const copyOtp = () => {
    if (otpData?.otp_code) {
      navigator.clipboard.writeText(otpData.otp_code);
      toast.success('OTP copied!');
    }
  };

  if (loading || !otpData) return null;

  if (otpData.is_verified) {
    return (
      <div className="bg-success/10 border border-success/30 rounded-lg p-4 flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-success" />
        <div>
          <p className="text-sm font-medium text-success">ডেলিভারি OTP ভেরিফাইড ✓</p>
          {otpData.verified_at && (
            <p className="text-xs text-muted-foreground">{new Date(otpData.verified_at).toLocaleString()}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-primary" />
        <span className="text-sm font-semibold text-foreground">ডেলিভারি OTP</span>
      </div>
      <p className="text-xs text-muted-foreground">
        ডেলিভারি বয়/সেলারকে এই OTP দিন। এটি ডেলিভারি সম্পন্ন করতে প্রয়োজন।
      </p>
      <div className="flex items-center gap-3 justify-center">
        <div className="bg-card border-2 border-primary rounded-lg px-6 py-3">
          <p className="text-3xl font-mono font-bold text-primary tracking-[0.3em]">{otpData.otp_code}</p>
        </div>
        <Button variant="outline" size="icon" onClick={copyOtp}>
          <Copy className="w-4 h-4" />
        </Button>
      </div>
      <p className="text-xs text-center text-muted-foreground">⚠️ এই OTP কাউকে শেয়ার করবেন না, শুধুমাত্র ডেলিভারির সময় দিন</p>
    </div>
  );
}
