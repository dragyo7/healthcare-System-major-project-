import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import PageHeader from "../../components/shared/PageHeader";
import Card from "../../components/shared/Card";
import Button from "../../components/ui/Button";
import { Send } from "lucide-react";
import { mockChatService } from "../../services/mock/mockChatService";
import { mockDoctorService } from "../../services/mock/mockDoctorService";
import { mockPatientService } from "../../services/mock/mockPatientService";
import { useAuth } from "../../contexts/AuthContext";

export default function Chat() {
  const { user } = useAuth();
  const location = useLocation();
  const messagesEndRef = useRef(null);

  const [targets, setTargets] = useState([]);
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const isDoctor = user?.role === "doctor";

  useEffect(() => {
    async function loadTargets() {
      if (isDoctor) {
        const plist = await mockPatientService.searchPatients("");
        setTargets(plist);
        
        const passedId = location.state?.patientId;
        if (passedId) {
          setSelectedTargetId(passedId);
        } else if (plist.length > 0) {
          setSelectedTargetId(plist[0].id);
        }
      } else {
        const dlist = await mockDoctorService.getDoctorList();
        setTargets(dlist);
        if (dlist.length > 0) {
          setSelectedTargetId(dlist[0].id);
        }
      }
    }
    loadTargets();
  }, [user, isDoctor, location.state]);

  useEffect(() => {
    async function loadMessages() {
      if (user?.id && selectedTargetId) {
        const patId = isDoctor ? selectedTargetId : user.id;
        const docId = isDoctor ? user.id : selectedTargetId;
        const data = await mockChatService.getMessages(patId, docId);
        setMessages(data);
      }
    }
    loadMessages();
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, [user, selectedTargetId, isDoctor]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !selectedTargetId) return;

    const patId = isDoctor ? selectedTargetId : user.id;
    const docId = isDoctor ? user.id : selectedTargetId;

    const res = await mockChatService.sendMessage({
      patientId: patId,
      doctorId: docId,
      sender: user.role,
      message: input,
    });

    setMessages((prev) => [...prev, res.data]);
    setInput("");

    setTimeout(async () => {
      const replySender = isDoctor ? "patient" : "doctor";
      const replyMsg = isDoctor
        ? "Got it, doctor. I will update my logs as instructed."
        : "Thank you for the update. I have reviewed your biometric telemetry logs.";
        
      const reply = await mockChatService.sendMessage({
        patientId: patId,
        doctorId: docId,
        sender: replySender,
        message: replyMsg,
      });
      setMessages((prev) => [...prev, reply.data]);
    }, 1500);
  };

  const selectedTargetName = targets.find((t) => t.id === selectedTargetId)?.name || "Consultant";

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-3xl mx-auto select-none animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
        <PageHeader
          title="Consultant Messaging"
          subtitle={`Secure message line connected directly with ${selectedTargetName}.`}
        />
        {targets.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold uppercase shrink-0">Chat with:</span>
            <select
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              className="h-9 px-3 border border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-white rounded-xl text-xs focus:outline-hidden"
            >
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <Card className="flex-1 flex flex-col min-h-0 p-4">
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4 pb-4">
          {messages.length === 0 ? (
            <p className="text-xs text-slate-500 text-center my-auto">Start a conversation with {selectedTargetName}.</p>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender === user?.role;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[75%] ${isMe ? "self-end items-end" : "self-start items-start"}`}
                >
                  <div
                    className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      isMe
                        ? "bg-primary-600 text-white rounded-br-none"
                        : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 rounded-bl-none"
                    }`}
                  >
                    {msg.message}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className="flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <input
            type="text"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-white text-sm focus:outline-hidden"
          />
          <Button type="submit" className="h-11 w-11 p-0 flex items-center justify-center rounded-xl shrink-0">
            <Send className="h-4.5 w-4.5" />
          </Button>
        </form>
      </Card>
    </div>
  );
}
