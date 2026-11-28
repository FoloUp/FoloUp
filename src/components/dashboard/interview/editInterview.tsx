"use client";

import QuestionCard from "@/components/dashboard/interview/create-popup/questionCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { useInterviewers } from "@/contexts/interviewers.context";
import { useInterviews } from "@/contexts/interviews.context";
import { InterviewService } from "@/services/interviews.service";
import type { Interview, Question } from "@/types/interview";
import { Plus, SaveIcon, TrashIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { CardTitle } from "../../ui/card";

type EditInterviewProps = {
  interview: Interview | undefined;
};

function EditInterview({ interview }: EditInterviewProps) {
  const { interviewers } = useInterviewers();
  const { fetchInterviews } = useInterviews();

  const [description, setDescription] = useState<string>(interview?.description || "");
  const [objective, setObjective] = useState<string>(interview?.objective || "");
  const [numQuestions, setNumQuestions] = useState<number>(interview?.question_count || 1);
  const [duration, setDuration] = useState<number>(Number(interview?.time_duration));
  const [questions, setQuestions] = useState<Question[]>(interview?.questions || []);
  const [selectedInterviewer, setSelectedInterviewer] = useState(interview?.interviewer_id);
  const [isAnonymous, setIsAnonymous] = useState<boolean>(interview?.is_anonymous || false);

  const [isClicked, setIsClicked] = useState(false);

  const endOfListRef = useRef<HTMLDivElement>(null);
  const prevQuestionLengthRef = useRef(questions.length);
  const router = useRouter();

  const handleInputChange = (id: string, newQuestion: Question) => {
    setQuestions(
      questions.map((question) =>
        question.id === id ? { ...question, ...newQuestion } : question,
      ),
    );
  };

  const handleDeleteQuestion = (id: string) => {
    if (questions.length === 1) {
      setQuestions(
        questions.map((question) => ({
          ...question,
          question: "",
          follow_up_count: 1,
        })),
      );

      return;
    }
    setQuestions(questions.filter((question) => question.id !== id));
    setNumQuestions(numQuestions - 1);
  };

  const handleAddQuestion = () => {
    if (questions.length < numQuestions) {
      setQuestions([...questions, { id: uuidv4(), question: "", follow_up_count: 1 }]);
    }
  };

  const onSave = async () => {
    const questionCount = questions.length < numQuestions ? questions.length : numQuestions;

    const interviewData = {
      objective: objective,
      questions: questions,
      interviewer_id: Number(selectedInterviewer),
      question_count: questionCount,
      time_duration: Number(duration),
      description: description,
      is_anonymous: isAnonymous,
    };

    try {
      if (!interview) {
        return;
      }
      const response = await InterviewService.updateInterview(interviewData, interview?.id);
      setIsClicked(false);
      fetchInterviews();
      toast.success("Interview updated successfully.", {
        position: "bottom-right",
        duration: 3000,
      });
      router.push(`/interviews/${interview?.id}`);
    } catch (error) {
      console.error("Error creating interview:", error);
    }
  };

  const onDeleteInterviewClick = async () => {
    if (!interview) {
      return;
    }

    try {
      await InterviewService.deleteInterview(interview.id);
      router.push("/dashboard");
    } catch (error) {
      console.error("Error deleting interview:", error);
      toast.error("Failed to delete the interview.", {
        position: "bottom-right",
        duration: 3000,
      });
    }
  };

  useEffect(() => {
    if (questions.length > prevQuestionLengthRef.current) {
      endOfListRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevQuestionLengthRef.current = questions.length;
  }, [questions.length]);

  return (
    <div className=" h-screen z-[10] mx-2">
      <div className="flex flex-col bg-gray-200 rounded-md min-h-[120px] p-2 pl-4">
        <div>
          <button
            type="button"
            className="mt-2 ml-1 pr-2 inline-flex items-center text-indigo-600 hover:cursor-pointer"
            onClick={() => {
              router.push(`/interviews/${interview?.id}`);
            }}
          >
            <ArrowLeft className="mr-2" />
            <p className="text-sm font-semibold">Back to Summary</p>
          </button>
        </div>
        <div className="flex flex-row justify-between">
          <p className="mt-3 mb-1 ml-2 font-medium">
            Interview Description{" "}
            <span className="text-xs ml-2 font-normal">(Your respondents will see this.)</span>
          </p>
          <div className="flex flex-row gap-3">
            <Button
              disabled={isClicked}
              className="bg-indigo-600 hover:bg-indigo-800 mt-2"
              onClick={() => {
                setIsClicked(true);
                onSave();
              }}
            >
              Save <SaveIcon size={16} className="ml-2" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={isClicked} className="bg-red-500 hover:bg-red-600 mr-5 mt-2 p-2">
                  <TrashIcon size={16} className="" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete this interview.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-indigo-600 hover:bg-indigo-800"
                    onClick={async () => {
                      await onDeleteInterviewClick();
                    }}
                  >
                    Continue
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        <textarea
          value={description}
          className="h-fit mt-3 ml-2 py-2 border-2 rounded-md w-[75%] px-2 border-gray-400"
          placeholder="Enter your interview description here."
          rows={3}
          onChange={(e) => {
            setDescription(e.target.value);
          }}
          onBlur={(e) => {
            setDescription(e.target.value.trim());
          }}
        />
        <p className="mt-3 mb-1 ml-2 font-medium">Objective</p>
        <textarea
          value={objective}
          className="h-fit mt-3 ml-2 py-2 border-2 rounded-md w-[75%] px-2 border-gray-400"
          placeholder="Enter your interview objective here."
          rows={3}
          onChange={(e) => setObjective(e.target.value)}
          onBlur={(e) => setObjective(e.target.value.trim())}
        />
        <div className="flex flex-row gap-3">
          <div>
            <p className="mt-3 mb-1 ml-2 font-medium">Interviewer</p>
            <div className=" flex items-center mt-1">
              <div
                id="slider-3"
                className=" h-32 pt-1 ml-2 overflow-x-scroll scroll whitespace-nowrap scroll-smooth scrollbar-hide w-[27.5rem]"
              >
                {interviewers.map((item) => (
                  <div
                    className=" p-0 inline-block cursor-pointer hover:scale-105 ease-in-out duration-300  ml-1 mr-3 rounded-xl shrink-0 overflow-hidden"
                    key={item.id}
                  >
                    <button
                      type="button"
                      className={`w-[96px] overflow-hidden rounded-full ${
                        selectedInterviewer === item.id ? "border-4 border-indigo-600" : ""
                      }`}
                      onClick={() => {
                        setSelectedInterviewer(item.id);
                      }}
                    >
                      <Image
                        src={item.image}
                        alt="Picture of the interviewer"
                        width={70}
                        height={70}
                        className="w-full h-full object-cover"
                      />
                    </button>
                    <CardTitle className="mt-0 text-xs text-center">{item.name}</CardTitle>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex-col mt-2 ml-2 w-full">
          <div className="flex items-center cursor-pointer">
            <span className="text-sm font-medium">
              Do you prefer the interviewees&apos; responses to be anonymous?
            </span>
            <Switch
              checked={isAnonymous}
              className={`ml-4 mt-1 border-2 border-gray-300 ${
                isAnonymous ? "bg-indigo-600" : "bg-white"
              }`}
              onCheckedChange={(checked) => setIsAnonymous(checked)}
            />
          </div>
          <span
            style={{ fontSize: "0.7rem", lineHeight: "0.66rem" }}
            className="font-light text-xs italic w-full text-left block"
          >
            Note: If not anonymous, the interviewee&apos;s email and name will be collected.
          </span>
        </div>
        <div className="flex flex-row justify-between w-[75%] gap-3 ml-2">
          <div className="flex flex-row justify-center items-center mt-5 ">
            <h3 className="font-medium ">No. of Questions:</h3>
            <input
              type="number"
              step="1"
              max="5"
              min={questions.length.toString()}
              className="border-2 text-center focus:outline-none  bg-slate-100 rounded-md border-gray-500 w-14 px-2 py-0.5 ml-3"
              value={numQuestions}
              onChange={(e) => {
                let value = e.target.value;
                if (value === "" || (Number.isInteger(Number(value)) && Number(value) > 0)) {
                  if (Number(value) > 5) {
                    value = "5";
                  }
                  setNumQuestions(Number(value));
                }
              }}
            />
          </div>
          <div className="flex flex-row items-center mt-5">
            <h3 className="font-medium ">Duration (mins):</h3>
            <input
              type="number"
              step="1"
              max="10"
              min="1"
              className="border-2 text-center focus:outline-none bg-slate-100 rounded-md border-gray-500 w-14 px-2 py-0.5 ml-3"
              value={Number(duration)}
              onChange={(e) => {
                let value = e.target.value;
                if (value === "" || (Number.isInteger(Number(value)) && Number(value) > 0)) {
                  if (Number(value) > 10) {
                    value = "10";
                  }
                  setDuration(Number(value));
                }
              }}
            />
          </div>
        </div>
        <p className="mt-3 mb-1 ml-2 font-medium">Questions</p>
        <ScrollArea className="flex ml-2 p-2 pr-4 mb-4 flex-col justify-center items-center w-[75%] max-h-[500px] bg-slate-100 rounded-md text-sm mt-3">
          {questions.map((question, index) => (
            <QuestionCard
              key={question.id}
              questionNumber={index + 1}
              questionData={question}
              onDelete={handleDeleteQuestion}
              onQuestionChange={handleInputChange}
            />
          ))}
          <div ref={endOfListRef} />
          {questions.length < numQuestions ? (
            <button
              type="button"
              className="border-indigo-600 opacity-75 hover:opacity-100 w-fit text-center rounded-full mx-auto"
              onClick={handleAddQuestion}
            >
              <Plus
                size={45}
                strokeWidth={2.2}
                className="text-indigo-600 text-center cursor-pointer"
              />
            </button>
          ) : (
            <></>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

export default EditInterview;
