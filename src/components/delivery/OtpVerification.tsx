import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface OtpVerificationProps {
  orderId: string;
  deliveryId: string;
  onVerified: () => void;
}

export default function OtpVerification({ orderId, deliveryId, onVerified }: OtpVerificationProps) {
  const { user } = useAuth();
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);

  const handleVerify = async () => {
    if (!user || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    setVerifying(true);

    // Check OTP
    const { data: otpRecord, error } = await supabase
      .from('delivery_otps')
      .select('*')
      .eq('order_id', orderId)
      .eq('otp_code', otp)
      .eq('is_verified', false)
      .single();

    if (error || !otpRecord) {
      toast.error('Invalid OTP. Please check and try again.');
      setVerifying(false);
      return;
    }

    // Check if expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      toast.error('OTP has expired. Please request a new one.');
      setVerifying(false);
      return;
    }

    // Mark as verified
    const { error: updateError } = await supabase
      .from('delivery_otps')
      .update({
        is_verified: true,
        verified_at: new Date().toISOString(),
        verified_by: user.id,
      })
      .eq('id', otpRecord.id);

    if (updateError) {
      toast.error('Failed to verify OTP');
      setVerifying(false);
      return;
    }

    setVerified(true);
    toast.success('OTP verified! Marking as delivered...');
    onVerified();
    setVerifying(false);
  };

  if (verified) {
    return (
      <div className="bg-success/10 border border-success/30 rounded-lg p-4 flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-success" />
        <span className="text-sm font-medium text-success">OTP Verified - Delivery Confirmed</span>
      </div>
    );
  }

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="w-5 h-5 text-primary" />
        <span className="text-sm font-semibold text-foreground">OTP Verification Required</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Customer-কে OTP জিজ্ঞেস করুন। ডেলিভারি সম্পন্ন করতে সঠিক OTP দিন।
      </p>
      <div className="flex gap-2">
        <Input
          placeholder="6-digit OTP"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          className="flex-1 text-center tracking-widest font-mono text-lg"
        />
        <Button onClick={handleVerify} disabled={otp.length !== 6 || verifying}>
          {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
        </Button>
      </div>
    </div>
  );
}
