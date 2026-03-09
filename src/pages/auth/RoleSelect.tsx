import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Store, Truck } from 'lucide-react';

const roles = [
  {
    key: 'customer',
    label: 'Customer',
    description: 'Browse & shop products',
    icon: ShoppingBag,
  },
  {
    key: 'seller',
    label: 'Seller',
    description: 'List & sell your products',
    icon: Store,
  },
  {
    key: 'delivery_boy',
    label: 'Delivery Partner',
    description: 'Deliver orders & earn',
    icon: Truck,
  },
];

export default function RoleSelect() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg animate-fade-in">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-heading font-bold tracking-tight text-foreground">
            Welcome to <span className="text-primary">ShopFlow</span>
          </h1>
          <p className="mt-2 text-muted-foreground text-lg">Choose how you'd like to get started</p>
        </div>

        <div className="space-y-4">
          {roles.map((role) => (
            <button
              key={role.key}
              onClick={() => navigate(`/auth/login?role=${role.key}`)}
              className="w-full group flex items-center gap-5 p-5 rounded-lg border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all duration-200"
            >
              <div className="flex-shrink-0 w-14 h-14 rounded-lg bg-accent flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <role.icon className="w-7 h-7 text-accent-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-heading font-semibold text-foreground">{role.label}</h3>
                <p className="text-sm text-muted-foreground">{role.description}</p>
              </div>
            </button>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Admin? Just log in with your admin email — no role selection needed.{' '}
          <button
            onClick={() => navigate('/auth/login?role=admin')}
            className="text-primary hover:underline font-medium"
          >
            Admin Login
          </button>
        </p>
      </div>
    </div>
  );
}
