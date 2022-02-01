import { motion } from "framer-motion";
export default function Index() {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100vh",
        justifyContent: "center"
      }}
    >
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 2 }}>
        <h1>Welcome to remix!</h1>
      </motion.div>
    </div>
  );
}
