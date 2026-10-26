import { Link } from 'react-router-dom';
import styles from './Landing.module.css';
import cp_logo from '../assets/CP_Truck Logo.png';

const Landing = () => {
  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.logo}>
          <div>CP <span>Truck</span></div>
          <img src={cp_logo} alt="cp_logo" />
        </div>
        <div className={styles.navActions}>
          <Link to="/login" className="btn btn-secondary">
            Log In
          </Link>
          <Link to="/register" className="btn btn-primary">
            Get Started
          </Link>
        </div>
      </nav>

      <main className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.badge}>Intelligent Dispatch System</span>
          <h1>Send packages faster, with real-time tracking you can trust.</h1>
          <p>
            CP Truck connects you with dispatch riders in minutes — book a pickup, pay securely,
            and follow your package every step of the way with live location and arrival
            predictions.
          </p>
          <div className={styles.heroActions}>
            <Link to="/register" className="btn btn-primary">
              Send a Package
            </Link>
            <Link to="/login" className="btn btn-secondary">
              Track My Package
            </Link>
          </div>
        </div>
      </main>

      <section className={styles.features}>
        <div className={`card ${styles.featureCard}`}>
          <h3>🤖 AI Chatbot Support</h3>
          <p>Powered by Google API for automated customer service, delivery inquiries, and real-time tracking lookups.</p>
        </div>
        <div className={`card ${styles.featureCard}`}>
          <h3>🛡️ Intelligent Fraud Detection</h3>
          <p>Multi-rule automated risk assessment to identify fake delivery requests and prevent transaction fraud.</p>
        </div>
        <div className={`card ${styles.featureCard}`}>
          <h3>⏱️ Delivery Time Prediction</h3>
          <p>Predictive estimation of package arrival based on route distance, urban traffic, and live rider GPS pings.</p>
        </div>
        <div className={`card ${styles.featureCard}`}>
          <h3>💳 Secure Online Payments</h3>
          <p>Integrated Paystack gateway ensuring seamless and secure payment confirmation prior to rider assignment.</p>
        </div>
      </section>
    </div>
  );
};

export default Landing;
