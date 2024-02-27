const questions = [
  {
    question: "Which planet is known as the Red Planet?",
    answers: [
     {text:"Venus",correct:false},
     {text:"Mars",correct:true},
   {text:"Jupiter",correct:false},
    {text:"Saturn",correct:false},
      ]
  },
 {
  question:"Who painted the Mona Lisa?",
  answers: [
    {text:"Vincent van Gogh",correct:false},
    {text:"Pablo Picasso",correct:false},
    {text:"Leonardo da Vinci",correct:true},
    {text:"Michelangelo",correct:false},
    ]
 },
  {
  question:"What is the chemical symbol for water?",
  answers: [
    {text:"H2O",correct:true},
    {text:"CO2",correct:false},
    {text:"O2",correct:false},
    {text:"H2SO4",correct:false},
    ]
 },
  {
  question:"What is the tallest mammal in the world?",
  answers: [
  {text:"Elephant",correct:false},
  {text:"Rhinoceros",correct:false},
   {text:"Hippopotamus",correct:false},
    {text:"Giraffe",correct:true},
    ]
 },
   {
  question:"Which country is famous for the Great Wall?",
  answers: [
  {text:"Nepal",correct:false},
  {text:"Japan",correct:false},
   {text:"China",correct:true},
    {text:"India",correct:false},
    ]
 },
   {
  question:"Who is known as the Father of Computers?",
  answers: [
  {text:"Bill Gates",correct:false},
  {text:"Blaise Pascal",correct:false},
   {text:"Steve Jobs",correct:false},
    {text:"Charles Babbage",correct:true},
    ]
 },
   {
  question:"Who wrote the Harry Potter book series?",
  answers: [
  {text:"J.R.R Tolkien",correct:false},
  {text:"J.K Rownlimg",correct:true},
   {text:"Stephen Meyn ",correct:false},
    {text:"Robert kyasoiki",correct:false},
    ]
 },
   {
  question:"What is the largest ocean in the world?",
  answers: [
  {text:"Atlantic Ocean",correct:false},
  {text:"Pacific Ocean",correct:true},
   {text:"Indian Ocean",correct:false},
    {text:"Arctic Ocean",correct:false},
    ]
 },
   {
  question:"What is the capital city of France?",
  answers: [
  {text:"London",correct:false},
  {text:"Rome",correct:false},
   {text:"Paris ",correct:true},
    {text:"Madrid",correct:false},
    ]
 },
   {
  question:"Kathmandu (Nepal) is famous for ?",
  answers: [
  {text:"Temples",correct:false},
  {text:"Culture",correct:false},
   {text:"Hiking",correct:false},
    {text:"All above",correct:true},
    ]
 }
  ];
  
  const questionElement = document.getElementById("question");
  const answerButtons = document.getElementById("answer-buttons");
  const nextButton = document.getElementById("next-btn");
  
  let currentQuestionIndex = 0;
  let score = 0;
  
  function startQuiz(){
    currentQuestionIndex = 0;
    score = 0;
    nextButton.innerHTML = "Next";
    showQuestion();
  }
  
  function showQuestion(){
    resetState();
    let currentQuestion=questions[currentQuestionIndex];
  let questionNo = currentQuestionIndex + 1;
  questionElement.innerHTML = questionNo +". " + currentQuestion.question;
    
    currentQuestion.answers.forEach(answer => {
      const button = document.createElement("button");
      button.innerHTML = answer.text;
     button.classList.add("btn");
      answerButtons.appendChild(button);
      if(answer.correct){
        button.dataset.correct = answer.correct;
      }
      button.addEventListener("click",selectAnswer)
    });
  }
  
  function resetState(){
    nextButton.style.display = "none";
  while(answerButtons.firstChild){
    answerButtons.removeChild(answerButtons.firstChild);
  }
  }
  
  function selectAnswer(e){
    const selectedBtn = e.target;
    const isCorrect = selectedBtn.dataset.correct === 'true';
    if(isCorrect){
      selectedBtn.classList.add("correct");
      score++;
    }else{
      selectedBtn.classList.add("incorrect");
    }
    Array.from(answerButtons.children).forEach(button => {
      if(button.dataset.correct === "true"){
        button.classList.add("correct");
      }
      button.disabled=true;
    });
    nextButton.style.display="block";
  }
  
  function showScore(){
    resetState();
    questionElement.innerHTML = `You score ${score} out of ${questions.length} !`;
    nextButton.innerHTML="Play Again";
    nextButton.style.display = "block"; 
  };
  
  function handleNextButton(){
    currentQuestionIndex++;
    if(currentQuestionIndex < questions.length){
      showQuestion();
  }else{
    showScore();
  }
  }
  nextButton.addEventListener("click",()=>{
    if(currentQuestionIndex < questions.length){
      handleNextButton();
    }else{
      startQuiz();
    }
  });
  
  startQuiz();
  
 