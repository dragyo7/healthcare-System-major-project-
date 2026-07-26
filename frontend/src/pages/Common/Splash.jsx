import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";

export default function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/login");
    }, 2200);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-slate-950 text-white overflow-hidden select-none">
      {/* Animated Glow Background */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute w-[300px] h-[300px] bg-primary-600/20 blur-3xl rounded-full pointer-events-none"
      />

      <div className="relative flex flex-col items-center gap-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600 shadow-xl shadow-primary-500/20 text-white"
        >
          <Activity className="h-8 w-8 animate-pulse" />
        </motion.div>

        <div className="text-center">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-2xl font-bold tracking-wider"
          >
            MedAI PLATFORM
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="text-xs tracking-widest text-slate-400 mt-2 uppercase"
          >
            Securing Clinical Environments
          </motion.p>
        </div>
      </div>
    </div>
  );
}
