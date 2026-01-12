import { Link } from "react-router-dom";
import { Thermometer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const TermsConditions = () => {
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
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Terms & Conditions</h1>
            <p className="text-muted-foreground mb-8">Last Updated: January 2025</p>

            <div className="space-y-8 text-foreground/90">
              <section>
                <h2 className="text-xl font-semibold text-foreground mb-4">1. Acceptance of Terms</h2>
                <p className="mb-4">
                  By accessing or using FrostGuard, a product of OEM Auto Marine Inc ("we," "our," or "us"), 
                  you agree to be bound by these Terms & Conditions ("Terms"). If you do not agree to these 
                  Terms, please do not use our service.
                </p>
                <p>
                  These Terms apply to all users, including visitors, registered users, and anyone who accesses 
                  or uses the FrostGuard service.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-4">2. Description of Service</h2>
                <p className="mb-4">
                  FrostGuard is a refrigeration monitoring platform designed to help businesses maintain food 
                  safety compliance. Our service includes:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Real-time temperature monitoring via wireless sensors</li>
                  <li>Automated alerts via SMS, email, and push notifications</li>
                  <li>Manual temperature logging capabilities</li>
                  <li>Compliance reporting and audit trail generation</li>
                  <li>Dashboard and analytics for monitoring equipment status</li>
                </ul>
              </section>

              <section className="bg-accent/5 border border-accent/20 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">3. SMS Notification Terms</h2>
                <p className="mb-4">
                  <strong>Important:</strong> By opting in to receive SMS notifications from FrostGuard, you agree to the following terms:
                </p>
                <ul className="list-disc pl-6 space-y-3">
                  <li>
                    <strong>STOP to Opt-Out:</strong> You may opt out of SMS notifications at any time by 
                    replying <strong>STOP</strong> to any message. You will receive a confirmation message 
                    and will no longer receive SMS alerts. Note that opting out of SMS does not affect other 
                    notification channels (email, push).
                  </li>
                  <li>
                    <strong>HELP for Support:</strong> Reply <strong>HELP</strong> to any message for support 
                    information. You will receive a message with contact details for assistance.
                  </li>
                  <li>
                    <strong>Message Frequency:</strong> Message frequency varies based on your alert 
                    configuration and temperature events at your monitored locations. During normal operations, 
                    you may receive few or no messages. During temperature excursions or equipment issues, 
                    you may receive multiple alerts.
                  </li>
                  <li>
                    <strong>Message and Data Rates:</strong> Standard message and data rates may apply 
                    depending on your mobile carrier plan. FrostGuard is not responsible for any charges 
                    from your carrier.
                  </li>
                  <li>
                    <strong>Carrier Disclaimer:</strong> Carriers are not liable for delayed or undelivered 
                    messages. Delivery of SMS messages is subject to effective transmission from your mobile 
                    carrier and network availability.
                  </li>
                  <li>
                    <strong>Supported Carriers:</strong> SMS notifications are available on most major U.S. 
                    carriers. Availability may vary for smaller or regional carriers.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-4">4. User Accounts and Responsibilities</h2>
                <p className="mb-4">To use FrostGuard, you must:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Create an account with accurate and complete information</li>
                  <li>Maintain the security of your account credentials</li>
                  <li>Notify us immediately of any unauthorized access to your account</li>
                  <li>Be responsible for all activities that occur under your account</li>
                </ul>
                <p className="mt-4">
                  You agree to use FrostGuard only for lawful purposes and in accordance with these Terms. 
                  You shall not use the service to violate any applicable laws or regulations.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-4">5. Service Availability</h2>
                <p className="mb-4">
                  While we strive to maintain high availability, FrostGuard is provided on an "as-is" and 
                  "as-available" basis. We do not guarantee:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Uninterrupted or error-free operation of the service</li>
                  <li>That all alerts will be delivered in real-time or at all</li>
                  <li>Compatibility with all devices, sensors, or network configurations</li>
                </ul>
                <p className="mt-4">
                  We may temporarily suspend the service for maintenance, updates, or other operational reasons. 
                  We will make reasonable efforts to provide advance notice when possible.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-4">6. Limitation of Liability</h2>
                <p className="mb-4">
                  <strong>Important:</strong> To the maximum extent permitted by law:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    OEM Auto Marine Inc, FrostGuard, and its affiliates shall not be liable for any indirect, 
                    incidental, special, consequential, or punitive damages arising from your use of the service.
                  </li>
                  <li>
                    We are not liable for any food spoilage, inventory loss, compliance violations, or other 
                    damages resulting from service interruptions, delayed alerts, or sensor malfunctions.
                  </li>
                  <li>
                    Our total liability for any claims arising from your use of FrostGuard shall not exceed 
                    the amount you paid for the service in the twelve (12) months preceding the claim.
                  </li>
                </ul>
                <p className="mt-4">
                  FrostGuard is a monitoring tool designed to assist with food safety compliance. It does not 
                  replace proper food safety procedures, training, or human oversight. You remain responsible 
                  for ensuring compliance with all applicable food safety regulations.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-4">7. Disclaimer of Warranties</h2>
                <p>
                  FrostGuard is provided "as is" without warranties of any kind, either express or implied, 
                  including but not limited to implied warranties of merchantability, fitness for a particular 
                  purpose, and non-infringement. We do not warrant that the service will meet your specific 
                  requirements or that the service will be available at all times.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-4">8. Intellectual Property</h2>
                <p>
                  The FrostGuard service, including its design, features, content, and underlying technology, 
                  is owned by OEM Auto Marine Inc and is protected by copyright, trademark, and other 
                  intellectual property laws. You may not copy, modify, distribute, or reverse engineer any 
                  part of the service without our prior written consent.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-4">9. Termination</h2>
                <p className="mb-4">
                  We may suspend or terminate your access to FrostGuard at any time, with or without cause, 
                  and with or without notice. Grounds for termination include:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Violation of these Terms</li>
                  <li>Non-payment of fees</li>
                  <li>Conduct that we determine to be harmful to other users or the service</li>
                  <li>Request by law enforcement or government agencies</li>
                </ul>
                <p className="mt-4">
                  Upon termination, your right to use the service will immediately cease. Data retention 
                  following termination is subject to our Privacy Policy.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-4">10. Governing Law</h2>
                <p>
                  These Terms shall be governed by and construed in accordance with the laws of the State 
                  of California, United States, without regard to its conflict of law provisions. Any disputes 
                  arising from these Terms or your use of FrostGuard shall be resolved in the state or federal 
                  courts located in California.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-4">11. Changes to Terms</h2>
                <p>
                  We reserve the right to modify these Terms at any time. We will notify you of any material 
                  changes by posting the updated Terms on this page and updating the "Last Updated" date. 
                  Your continued use of FrostGuard after any changes constitutes your acceptance of the new Terms.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-foreground mb-4">12. Severability</h2>
                <p>
                  If any provision of these Terms is found to be unenforceable or invalid, that provision 
                  shall be limited or eliminated to the minimum extent necessary, and the remaining provisions 
                  shall remain in full force and effect.
                </p>
              </section>

              <section className="bg-muted/50 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-foreground mb-4">13. Contact Us</h2>
                <p className="mb-4">
                  If you have any questions about these Terms & Conditions, please contact us:
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

export default TermsConditions;
