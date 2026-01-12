import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Thermometer, Shield, Bell, Smartphone, BarChart3, Clock, CheckCircle2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: Thermometer,
    title: "Real-Time Monitoring",
    description: "24/7 automated temperature tracking with instant readings from wireless sensors."
  },
  {
    icon: Bell,
    title: "Smart Alerts",
    description: "Immediate notifications via push, email, or SMS when temperatures go out of range."
  },
  {
    icon: Shield,
    title: "HACCP Compliance",
    description: "Inspection-ready logs and tamper-evident audit trails for food safety compliance."
  },
  {
    icon: Smartphone,
    title: "Mobile-First PWA",
    description: "Works offline, installable on any device. Log temperatures even without internet."
  },
  {
    icon: BarChart3,
    title: "Detailed Reports",
    description: "Export CSV reports, view temperature trends, and generate compliance documents."
  },
  {
    icon: Clock,
    title: "Manual Mode Fallback",
    description: "When sensors fail, automatic prompts ensure staff log temperatures manually."
  }
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                <Thermometer className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-foreground">FrostGuard</span>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/auth">
                <Button variant="ghost" size="sm">Sign In</Button>
              </Link>
              <Link to="/auth?mode=signup">
                <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden hero-gradient">
        <div 
          className="absolute inset-0 opacity-10" 
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='1'%3E%3Cpath d='M0 20h40M20 0v40'/%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '40px 40px'
          }} 
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div 
            className="max-w-4xl mx-auto text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white/90 text-sm mb-6">
              <Shield className="w-4 h-4" />
              <span>HACCP & FDA Compliant</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Refrigeration Monitoring for
              <span className="text-accent"> Food Safety</span>
            </h1>
            <p className="text-lg sm:text-xl text-white/80 mb-8 max-w-2xl mx-auto">
              Protect your inventory, ensure compliance, and prevent costly spoilage with 24/7 automated temperature monitoring.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/auth?mode=signup">
                <Button size="lg" className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-8">
                  Start Free Trial
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Button size="lg" variant="ghost" className="w-full sm:w-auto border border-white/30 text-white hover:bg-white/10">
                Watch Demo
              </Button>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div 
            className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {[
              { value: "99.9%", label: "Uptime" },
              { value: "5,000+", label: "Units Monitored" },
              { value: "< 30s", label: "Alert Response" },
              { value: "$2M+", label: "Food Saved" }
            ].map((stat, i) => (
              <div key={i} className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="text-2xl sm:text-3xl font-bold text-white">{stat.value}</div>
                <div className="text-sm text-white/60">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 md:py-32 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Everything You Need for Compliance
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From automated monitoring to manual logging fallbacks, FrostGuard keeps your food safe and your records inspection-ready.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                className="stat-card card-hover"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                viewport={{ once: true }}
              >
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
            Ready to Protect Your Inventory?
          </h2>
          <p className="text-lg text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            Start your 14-day free trial. No credit card required.
          </p>
          <Link to="/auth?mode=signup">
            <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-8">
              Get Started Free
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-sidebar border-t border-sidebar-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-sidebar-primary flex items-center justify-center">
                <Thermometer className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-sidebar-foreground">FrostGuard</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <Link to="/privacy" className="text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms" className="text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors">
                Terms & Conditions
              </Link>
            </div>
            <p className="text-sm text-sidebar-foreground/60">
              © {new Date().getFullYear()} OEM Auto Marine Inc. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
