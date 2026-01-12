import { Link } from "react-router-dom";
import { Thermometer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                <Thermometer className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-foreground">FrostGuard</span>
            </Link>
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Privacy Policy</h1>
            <p className="text-muted-foreground mb-8">Last Updated: January 2025</p>

            <div className="space-y-8 text-foreground/90">
              <section>
                <h2 className="text-xl font-semibold text-foreground mb-4">1. Introduction</h2>
                <p className="mb-4">
                  FrostGuard, a product of OEM Auto Marine Inc ("we," "our," or "us"), is committed to protecting 
                  your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your 
                  information when you use our refrigeration monitoring service.
                </p>
                <p>
                  By using FrostGuard, you agree to the collection and use of information in accordance with this policy.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-4">2. Information We Collect</h2>
                <p className="mb-4">We collect the following types of information:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Account Information:</strong> Name, email address, phone number, and organization details when you create an account.</li>
                  <li><strong>Device Data:</strong> Temperature readings, sensor status, battery levels, and connectivity information from monitoring devices.</li>
                  <li><strong>Usage Data:</strong> Information about how you interact with our service, including log entries, alert acknowledgments, and report generation.</li>
                  <li><strong>Technical Data:</strong> IP address, browser type, device information, and access times for security and service improvement.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-4">3. How We Use Your Information</h2>
                <p className="mb-4">We use the information we collect to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Provide and maintain the FrostGuard temperature monitoring service</li>
                  <li>Send temperature alerts and notifications via SMS, email, or push notifications</li>
                  <li>Generate compliance reports and audit logs for food safety regulations</li>
                  <li>Improve our service and develop new features</li>
                  <li>Respond to customer support requests</li>
                  <li>Ensure the security and integrity of our platform</li>
                </ul>
              </section>

              <section className="bg-accent/5 border border-accent/20 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">4. SMS/Text Message Communications</h2>
                <p className="mb-4">
                  <strong>Important:</strong> This section specifically addresses how we handle phone numbers and SMS communications:
                </p>
                <ul className="list-disc pl-6 space-y-3">
                  <li>
                    <strong>Opt-In Only:</strong> We only send SMS messages to phone numbers that have been explicitly 
                    opted-in to receive temperature alerts and notifications. You must actively consent to receive 
                    SMS alerts during account setup or through your notification settings.
                  </li>
                  <li>
                    <strong>Purpose:</strong> SMS messages are used solely for critical temperature alerts, 
                    equipment status notifications, and service-related communications. We do not send 
                    marketing or promotional messages via SMS.
                  </li>
                  <li>
                    <strong>No Selling or Sharing:</strong> We do not sell, rent, lease, or share your phone 
                    number with third parties for marketing purposes. Your phone number is used exclusively 
                    for FrostGuard alert notifications.
                  </li>
                  <li>
                    <strong>Message Frequency:</strong> Message frequency varies based on your alert settings 
                    and temperature events. You control which alerts you receive through your account settings.
                  </li>
                  <li>
                    <strong>Opt-Out:</strong> You can opt out of SMS notifications at any time by replying 
                    <strong> STOP</strong> to any message or by updating your notification preferences in 
                    your account settings.
                  </li>
                  <li>
                    <strong>Carrier Rates:</strong> Standard message and data rates may apply depending on 
                    your mobile carrier plan.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-4">5. Data Sharing and Disclosure</h2>
                <p className="mb-4">We may share your information only in the following circumstances:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Service Providers:</strong> We work with trusted third-party service providers (such as cloud hosting and SMS delivery services) who assist in operating our service. These providers are bound by contractual obligations to keep your information confidential.</li>
                  <li><strong>Legal Requirements:</strong> We may disclose your information if required by law, court order, or governmental authority.</li>
                  <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction.</li>
                </ul>
                <p className="mt-4 font-semibold">
                  We do not sell your personal information to third parties.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-4">6. Data Security</h2>
                <p className="mb-4">
                  We implement appropriate technical and organizational measures to protect your information, including:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Encryption of data in transit and at rest</li>
                  <li>Secure authentication and access controls</li>
                  <li>Regular security assessments and monitoring</li>
                  <li>Employee training on data protection practices</li>
                </ul>
                <p className="mt-4">
                  While we strive to protect your information, no method of transmission over the Internet or 
                  electronic storage is 100% secure.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-4">7. Data Retention</h2>
                <p>
                  We retain your information for as long as your account is active or as needed to provide you 
                  services, comply with legal obligations (including food safety record-keeping requirements), 
                  resolve disputes, and enforce our agreements. Temperature logs may be retained for extended 
                  periods to meet HACCP and regulatory compliance requirements.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-4">8. Your Rights</h2>
                <p className="mb-4">Depending on your location, you may have the following rights:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
                  <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
                  <li><strong>Deletion:</strong> Request deletion of your personal information, subject to legal retention requirements</li>
                  <li><strong>Opt-Out:</strong> Opt out of certain data processing activities, including SMS notifications</li>
                </ul>
                <p className="mt-4">
                  To exercise these rights, please contact us using the information below.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-4">9. Children's Privacy</h2>
                <p>
                  FrostGuard is not intended for use by individuals under the age of 18. We do not knowingly 
                  collect personal information from children.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-4">10. Changes to This Policy</h2>
                <p>
                  We may update this Privacy Policy from time to time. We will notify you of any changes by 
                  posting the new Privacy Policy on this page and updating the "Last Updated" date. We encourage 
                  you to review this Privacy Policy periodically.
                </p>
              </section>

              <section className="bg-muted/50 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">11. Contact Us</h2>
                <p className="mb-4">
                  If you have any questions about this Privacy Policy or our data practices, please contact us:
                </p>
                <div className="space-y-2">
                  <p><strong>FrostGuard</strong> (a product of OEM Auto Marine Inc)</p>
                  <p>Email: <a href="mailto:peter@sustainablefinishes.com" className="text-accent hover:underline">peter@sustainablefinishes.com</a></p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 bg-sidebar border-t border-sidebar-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-accent to-sidebar-primary flex items-center justify-center">
                <Thermometer className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-semibold text-sidebar-foreground">FrostGuard</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <Link to="/privacy" className="text-sidebar-foreground/80 hover:text-sidebar-foreground">Privacy Policy</Link>
              <Link to="/terms" className="text-sidebar-foreground/80 hover:text-sidebar-foreground">Terms & Conditions</Link>
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

export default PrivacyPolicy;
