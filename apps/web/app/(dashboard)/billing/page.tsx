'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CreditCard,
  Download,
  Check,
  AlertCircle,
  Zap,
  HardDrive,
  Activity,
  Clock,
  Loader2
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useStore } from '@/store';

export default function BillingPage() {
  const { toast } = useToast();
  const { plans, subscription, fetchPlans, fetchSubscription, fetchUpdateSubscription } = useStore();
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
    fetchSubscription();
  }, [fetchPlans, fetchSubscription]);

  const currentPlanName = subscription?.plan_name || 'Pro';
  const currentPlanPrice = subscription?.price || 49;
  const usage = subscription?.usage || { agents_used: 0, workflows_used: 0, runs_this_month: 0, runs_limit: 5000 };

  const FALLBACK_TIERS = [
    { id: 'free', name: 'Free', price: '$0', period: '/mo', description: 'Perfect for exploring the platform.', features: ['1,000 API calls', '1GB Storage', '10 Workflow runs', 'Community Support'] },
    { id: 'pro', name: 'Pro', price: '$49', period: '/mo', description: 'For power users and small teams.', features: ['50,000 API calls', '50GB Storage', '500 Workflow runs', 'Priority Support', 'Advanced Analytics'], popular: true },
    { id: 'enterprise', name: 'Enterprise', price: '$199', period: '/mo', description: 'For large scale operations.', features: ['Unlimited API calls', '500GB Storage', 'Unlimited Workflow runs', '24/7 Phone Support', 'Custom Integrations', 'Dedicated Account Manager'] },
  ];

  const PRICING_TIERS: any[] = Array.isArray(plans) && plans.length > 0
    ? plans.map((p: any) => ({
        id: p.id,
        name: p.name,
        price: typeof p.price === 'number' ? `$${p.price}` : p.price,
        period: p.period || '/mo',
        description: p.description || `Up to ${p.agents} agents, ${p.workflows} workflows, ${p.runs?.toLocaleString?.() ?? p.runs} runs/mo.`,
        features: p.features || [],
        popular: p.popular ?? p.id === 'pro',
        agents: p.agents,
        workflows: p.workflows,
      }))
    : FALLBACK_TIERS;

  const usageMetrics = [
    { label: 'Workflow Runs', used: usage.runs_this_month || 0, limit: usage.runs_limit || 5000, icon: Activity, format: 'number' },
    { label: 'Agents', used: usage.agents_used || 0, limit: PRICING_TIERS.find((t: any) => t.name === currentPlanName)?.agents || 20, icon: Zap, format: 'number' },
    { label: 'Workflows', used: usage.workflows_used || 0, limit: PRICING_TIERS.find((t: any) => t.name === currentPlanName)?.workflows || 50, icon: HardDrive, format: 'number' },
  ];

  const billingHistory = [
    { id: 'INV-2026-07', date: 'Jul 1, 2026', description: `${currentPlanName} Plan - Monthly`, amount: `$${currentPlanPrice}.00`, status: 'Paid' },
    { id: 'INV-2026-06', date: 'Jun 1, 2026', description: `${currentPlanName} Plan - Monthly`, amount: `$${currentPlanPrice}.00`, status: 'Paid' },
    { id: 'INV-2026-05', date: 'May 1, 2026', description: `${currentPlanName} Plan - Monthly`, amount: `$${currentPlanPrice}.00`, status: 'Paid' },
  ];

  const handleSwitchPlan = async (planId: string) => {
    setSwitching(planId);
    try {
      await fetchUpdateSubscription(planId);
      toast("success", `Switched to ${PRICING_TIERS.find((t: any) => t.id === planId)?.name || planId} plan`);
    } catch (e) {
      toast("error", "Failed to switch plan");
    } finally {
      setSwitching(null);
    }
  };
  
  const getProgressColor = (percent: number) => {
    if (percent >= 90) return 'var(--danger)';
    if (percent >= 75) return 'var(--warning)';
    return 'var(--text-primary)';
  };

  return (
    <div data-ui-sweep className="page-shell animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
        <div>
          <h1 className="page-heading text-[var(--text-primary)] mb-2">Billing & Plans</h1>
          <p className="text-[14px] text-[var(--text-secondary)]">Manage your subscription, usage, and payment methods.</p>
        </div>
      </header>

      {/* Current Plan & Payment Method */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6 flex flex-col"
        >
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-[13px] font-medium tracking-body text-[var(--text-secondary)] mb-2">Current Plan</h2>
              <div className="flex items-center gap-3">
                <span className="text-[32px] font-medium tracking-header-lg text-[var(--text-primary)]">{currentPlanName}</span>
                <span className="px-2.5 py-1 bg-[var(--surface-2)] shadow-[var(--edge-subtle)] text-[var(--success)] rounded-full text-[11px] font-medium tracking-micro">Active</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[32px] font-medium tracking-header-lg text-[var(--text-primary)] font-mono">${currentPlanPrice}<span className="text-[16px] text-[var(--text-tertiary)]">/mo</span></div>
            </div>
          </div>
          <div className="mt-auto pt-4 border-t border-[rgba(255,255,255,0.04)] flex justify-between text-[12px] font-mono text-[var(--text-tertiary)]">
            <span>Next billing date:</span>
            <span className="text-[var(--text-secondary)]">{subscription?.next_billing_date ? new Date(subscription.next_billing_date).toLocaleDateString() : "—"}</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="card p-6 flex flex-col"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-[13px] font-medium tracking-body text-[var(--text-secondary)]">Payment Method</h2>
            <CreditCard className="w-5 h-5 text-[var(--text-tertiary)]" />
          </div>
          <div className="flex items-center gap-4 mb-6">
            <div className="px-4 py-2.5 bg-[var(--surface-2)] shadow-[var(--edge-subtle)] rounded-lg">
              <span className="font-semibold italic text-[14px] text-[var(--text-primary)]">Visa</span>
            </div>
            <div>
              <div className="text-[15px] font-medium tracking-body text-[var(--text-primary)]">•••• •••• •••• 4242</div>
              <div className="text-[12px] font-mono text-[var(--text-tertiary)] mt-0.5">Expires 12/28</div>
            </div>
          </div>
          <div className="mt-auto">
            <button className="btn-secondary w-full justify-center">
              Update Payment Method
            </button>
          </div>
        </motion.div>
      </div>

      {/* Usage Metrics */}
      <div className="mb-16">
        <h2 className="text-[15px] font-medium tracking-body text-[var(--text-primary)] mb-6">Current Usage</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {usageMetrics.map((metric, index) => {
            const percent = (metric.used / metric.limit) * 100;
            const Icon = metric.icon;
            return (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="card p-5"
              >
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2 text-[12px] font-medium tracking-body text-[var(--text-secondary)]">
                    <Icon className="w-4 h-4 text-[var(--text-tertiary)]" />
                    {metric.label}
                  </div>
                  <span className="text-[11px] font-mono text-[var(--text-tertiary)]">
                    {metric.used.toLocaleString()}{metric.format === 'gb' ? ' GB' : metric.format === 'hours' ? ' hrs' : ''} / {metric.limit.toLocaleString()}{metric.format === 'gb' ? ' GB' : metric.format === 'hours' ? ' hrs' : ''}
                  </span>
                </div>
                <div className="h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]">
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: getProgressColor(percent) }} 
                  />
                </div>
                {percent >= 90 && (
                  <div className="flex items-center gap-1.5 mt-3 text-[var(--danger)] text-[11px] font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Nearing limit. Consider upgrading.</span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Plans Comparison */}
      <div className="mb-16">
        <h2 className="text-[15px] font-medium tracking-body text-[var(--text-primary)] mb-8 text-center">Choose Your Plan</h2>
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${PRICING_TIERS.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          {PRICING_TIERS.map((tier: any) => (
            <div 
              key={tier.id} 
              className={`card p-8 flex flex-col relative overflow-hidden transition-colors ${
                tier.popular ? 'bg-[var(--surface-2)] shadow-[var(--edge-default)]' : ''
              }`}
            >
              {tier.popular && (
                <div className="absolute top-0 left-0 right-0 bg-[var(--text-primary)] text-[var(--void)] text-center py-1.5 text-[10px] font-bold uppercase tracking-widest">
                  Most Popular
                </div>
              )}
              <h3 className={`text-[18px] font-medium tracking-body text-[var(--text-primary)] ${tier.popular ? 'mt-6' : ''}`}>{tier.name}</h3>
              <p className="text-[13px] text-[var(--text-secondary)] mt-2 leading-relaxed min-h-[40px]">{tier.description}</p>
              <div className="mt-6 mb-8 flex items-baseline">
                <span className="text-[48px] font-medium tracking-header-lg text-[var(--text-primary)] font-mono">{tier.price}</span>
                <span className="text-[14px] text-[var(--text-tertiary)] ml-1">{tier.period}</span>
              </div>
              
              <ul className="space-y-3 flex-grow mb-8">
                {tier.features.map((feature, i) => (
                  <li key={`${tier.name}-${i}`} className="flex items-start gap-3 text-[13px] text-[var(--text-secondary)] leading-relaxed">
                    <div className="w-4 h-4 rounded-full bg-[var(--surface-2)] shadow-[var(--edge-subtle)] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-[var(--text-primary)]" strokeWidth={3} />
                    </div>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button 
                onClick={() => handleSwitchPlan(tier.id)}
                className={currentPlanName === tier.name ? 'btn-secondary w-full justify-center' : 'btn-primary w-full justify-center'}
                disabled={currentPlanName === tier.name || switching === tier.id}
              >
                {switching === tier.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {currentPlanName === tier.name 
                  ? 'Current Plan' 
                  : switching === tier.id ? 'Switching...' : 'Switch'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Billing History */}
      <div>
        <div className="data-table">
          <div className="px-6 py-5 shadow-[0_1px_0_0_rgba(255,255,255,0.06)]">
            <h2 className="text-[15px] font-medium tracking-body text-[var(--text-primary)]">Billing History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
            <thead>
                <tr>
                  <th className="px-6 py-4 text-[12px] font-medium tracking-body text-[var(--text-secondary)]">Date</th>
                  <th className="px-6 py-4 text-[12px] font-medium tracking-body text-[var(--text-secondary)]">Description</th>
                  <th className="px-6 py-4 text-[12px] font-medium tracking-body text-[var(--text-secondary)]">Amount</th>
                  <th className="px-6 py-4 text-[12px] font-medium tracking-body text-[var(--text-secondary)]">Status</th>
                  <th className="px-6 py-4 text-[12px] font-medium tracking-body text-[var(--text-secondary)]"></th>
                </tr>
              </thead>
            <tbody>
                {billingHistory.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-6 py-4 text-[13px] font-mono text-[var(--text-secondary)]">{invoice.date}</td>
                    <td className="px-6 py-4 text-[14px] font-medium tracking-body text-[var(--text-primary)]">{invoice.description}</td>
                    <td className="px-6 py-4 text-[14px] font-mono text-[var(--text-primary)]">{invoice.amount}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[var(--surface-2)] shadow-[var(--edge-subtle)] text-[var(--success)] rounded-full text-[11px] font-medium tracking-micro">
                        {invoice.status === 'Paid' && <Check className="w-3 h-3" />}
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="btn-ghost text-[var(--text-tertiary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1.5 text-[12px]">
                        <Download className="w-4 h-4" />
                        Invoice
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
