// Global variables and constants
const themeColors = {
    'default': {
        primary: '#60a5fa',
        secondary: '#67e8f9',
        accent: '#3b82f6',
        backgroundStart: '#0f172a',
        backgroundMiddle: '#164e63',
        backgroundEnd: '#0f172a'
    },
    'ocean': {
        primary: '#22d3ee',
        secondary: '#5eead4',
        accent: '#06b6d4',
        backgroundStart: '#0f172a',
        backgroundMiddle: '#134e4a',
        backgroundEnd: '#0f172a'
    },
    'forest': {
        primary: '#4ade80',
        secondary: '#86efac',
        accent: '#22c55e',
        backgroundStart: '#0f172a',
        backgroundMiddle: '#14532d',
        backgroundEnd: '#0f172a'
    },
    'sunset': {
        primary: '#fb923c',
        secondary: '#fdba74',
        accent: '#f97316',
        backgroundStart: '#0f172a',
        backgroundMiddle: '#7c2d12',
        backgroundEnd: '#0f172a'
    },
    'purple': {
        primary: '#c084fc',
        secondary: '#d8b4fe',
        accent: '#a855f7',
        backgroundStart: '#0f172a',
        backgroundMiddle: '#581c87',
        backgroundEnd: '#0f172a'
    },
    'neon': {
        primary: '#a3e635',
        secondary: '#bef264',
        accent: '#84cc16',
        backgroundStart: '#0f172a',
        backgroundMiddle: '#365314',
        backgroundEnd: '#0f172a'
    },
    'ruby': {
        primary: '#f43f5e',
        secondary: '#fb7185',
        accent: '#e11d48',
        backgroundStart: '#0f172a',
        backgroundMiddle: '#881337',
        backgroundEnd: '#0f172a'
    },
    'midnight': {
        primary: '#818cf8',
        secondary: '#a5b4fc',
        accent: '#6366f1',
        backgroundStart: '#0f172a',
        backgroundMiddle: '#312e81',
        backgroundEnd: '#0f172a'
    }
};

// Define questions array - will be populated from JSON
let questions = [];

// Game state variables
let currentTeam = 'A';
let teamATheme = localStorage.getItem('teamATheme') || 'default';
let teamBTheme = localStorage.getItem('teamBTheme') || 'default';
let currentQuestionIndex = 0;
let teamAScore = 0;
let teamBScore = 0;
let teamAAnswered = false;
let teamBAnswered = false;
let teamACorrect = false;
let teamBCorrect = false;
let bothTeamsAnswered = false;
let teamASelectedAnswer = '';

// Theme handling function
function applyTheme(theme) {
    const colors = themeColors[theme];
    if (!colors) return;

    document.documentElement.style.setProperty('--primary', colors.primary);
    document.documentElement.style.setProperty('--secondary', colors.secondary);
    document.documentElement.style.setProperty('--accent', colors.accent);
    document.documentElement.style.setProperty('--background-start', colors.backgroundStart);
    document.documentElement.style.setProperty('--background-middle', colors.backgroundMiddle);
    document.documentElement.style.setProperty('--background-end', colors.backgroundEnd);
}

function animateScore(element, newScore) {
    // Save the current score
    const currentScore = parseInt(element.textContent);

    // Add animation class
    element.classList.add('score-animation');

    // Animate counting up
    let start = currentScore;
    const duration = 1000; // Animation duration in milliseconds
    const steps = 20; // Number of steps in the animation
    const increment = (newScore - start) / steps;
    const stepDuration = duration / steps;

    // Add highlight effect
    element.style.color = '#4ade80'; // Green highlight
    element.style.textShadow = '0 0 10px rgba(74, 222, 128, 0.5)';

    const counter = setInterval(() => {
        start += increment;
        // Round to handle decimal increments
        element.textContent = Math.round(start);

        if ((increment >= 0 && start >= newScore) ||
            (increment < 0 && start <= newScore)) {
            clearInterval(counter);
            element.textContent = newScore;

            // Reset styles after animation
            setTimeout(() => {
                element.classList.remove('score-animation');
                element.style.color = '';
                element.style.textShadow = '';
            }, 500);
        }
    }, stepDuration);
}

// Function to fetch questions from JSON file
async function fetchQuestions() {
    try {
        // The path should be relative to your HTML file, not the absolute server path
        const response = await fetch('/build/data/questions.json');
        if (!response.ok) {
            throw new Error('Failed to load questions');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error loading questions:', error);
        // Fallback to default questions if JSON fails to load
        return [
            {
                question: "What is the capital of France?",
                answers: [
                    { text: "London", correct: false },
                    { text: "Paris", correct: true },
                    { text: "Berlin", correct: false },
                    { text: "Madrid", correct: false }
                ],
                category: "Geography"
            },
            {
                question: "Which programming language is known as the 'language of the web'?",
                answers: [
                    { text: "Python", correct: false },
                    { text: "Java", correct: false },
                    { text: "JavaScript", correct: true },
                    { text: "C++", correct: false }
                ],
                category: "Technology"
            }
        ];
    }
}

// Function to randomly select questions from the question bank
function selectRandomQuestions(questionBank, count) {
    // If count is greater than available questions, return all questions
    if (count >= questionBank.length) {
        return [...questionBank];
    }
    
    // Create a copy of the question bank to avoid modifying the original
    const allQuestions = [...questionBank];
    const selectedQuestions = [];
    
    // Randomly select 'count' questions
    for (let i = 0; i < count; i++) {
        const randomIndex = Math.floor(Math.random() * allQuestions.length);
        selectedQuestions.push(allQuestions.splice(randomIndex, 1)[0]);
    }
    
    return selectedQuestions;
}

// Single DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const questionElement = document.getElementById("question");
    const answerButtons = document.getElementById("answer-buttons");
    const nextButton = document.getElementById("next-btn");
    const teamAScoreElement = document.getElementById("team-a-score");
    const teamBScoreElement = document.getElementById("team-b-score");
    
    // New elements for question selection
    const quizSetupElement = document.createElement("div");
    quizSetupElement.id = "quiz-setup";
    quizSetupElement.className = "p-6 mb-8 rounded-xl border bg-slate-800/50 border-white/10";
    
    let questionBank = []; // Will hold all available questions
    let questionCount = 5; // Default number of questions to use in the quiz
    let selectedCategory = "All"; // Default category selection

    // Function to get available categories from question bank
    function getCategories(questions) {
        const categories = new Set();
        questions.forEach(question => {
            if (question.category) {
                categories.add(question.category);
            }
        });
        return ["All", ...Array.from(categories)];
    }

    // Function to filter questions by category
    function filterQuestionsByCategory(questions, category) {
        if (category === "All") {
            return questions;
        }
        return questions.filter(question => question.category === category);
    }

    async function loadQuestionBank() {
        try {
            questionBank = await fetchQuestions();
            if (!Array.isArray(questionBank) || questionBank.length === 0) {
                throw new Error('No questions loaded');
            }
            return true;
        } catch (error) {
            console.error('Error loading question bank:', error);
            return false;
        }
    }

    function showQuizSetup() {
        // Clear current content
        resetState();
        
        // Get available categories
        const categories = getCategories(questionBank);
        
        // Create category menu items HTML
        const categoryMenuItems = categories.map(category => 
            `<button data-category="${category}" class="flex items-center px-3 py-2 w-full text-left rounded-lg transition-colors hover:bg-slate-700">
                <i class="mr-2 ri-bookmark-line"></i>${category}
            </button>`
        ).join('');
        
        // Create quiz setup UI with styled category selector
        quizSetupElement.innerHTML = `
            <h2 class="mb-6 text-2xl font-bold text-center">Quiz Setup</h2>
            
            <div class="mb-6">
                <label class="block mb-2 text-white/80">Category:</label>
                <div class="relative">
                    <button id="category-selector" class="flex items-center px-4 py-2 w-full rounded-lg border transition-colors bg-slate-700/50 border-white/10 hover:bg-slate-600/50">
                        <i class="mr-2 ri-book-line"></i>
                        <span id="current-category">${selectedCategory}</span>
                        <i class="ml-auto ri-arrow-down-s-line"></i>
                    </button>
                    <div id="category-menu" class="hidden absolute left-0 z-10 mt-2 w-full rounded-xl border shadow-xl bg-slate-800 border-white/10">
                        <div class="p-2 space-y-1">
                            ${categoryMenuItems}
                        </div>
                    </div>
                </div>
                <p class="mt-1 text-sm text-white/60">
                    <span id="available-questions">${filterQuestionsByCategory(questionBank, selectedCategory).length}</span> questions available in this category
                </p>
            </div>
            
            <button id="start-quiz-btn" class="py-3 w-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-lg transition-all hover:from-blue-600 hover:to-cyan-500">
                <i class="mr-2 ri-play-fill"></i>Start Quiz
            </button>
        `;
        
        // Add quiz setup to the page
        questionElement.innerHTML = "";
        questionElement.appendChild(quizSetupElement);
        
        // Add event listeners for category selector
        const categorySelector = document.getElementById('category-selector');
        const categoryMenu = document.getElementById('category-menu');
        
        // Toggle category menu
        categorySelector.addEventListener('click', () => {
            categoryMenu.classList.toggle('hidden');
        });
        
        // Handle category selection
        document.querySelectorAll('#category-menu button').forEach(button => {
            button.addEventListener('click', () => {
                selectedCategory = button.dataset.category;
                document.getElementById('current-category').textContent = selectedCategory;
                const filteredQuestions = filterQuestionsByCategory(questionBank, selectedCategory);
                document.getElementById('available-questions').textContent = filteredQuestions.length;
                categoryMenu.classList.add('hidden');
            });
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#category-selector') && !e.target.closest('#category-menu')) {
                categoryMenu.classList.add('hidden');
            }
        });
        
        document.getElementById('start-quiz-btn').addEventListener('click', startQuiz);
    }

    async function startQuiz() {
        try {
            // If question bank is not loaded yet, load it
            if (questionBank.length === 0) {
                const loaded = await loadQuestionBank();
                if (!loaded) {
                    throw new Error('Failed to load question bank');
                }
            }
            
            // Filter questions by selected category and use all of them
            questions = filterQuestionsByCategory(questionBank, selectedCategory);
            
            // Reset game state
            currentQuestionIndex = 0;
            teamAScore = 0;
            teamBScore = 0;
            currentTeam = 'A';
            teamAAnswered = false;
            teamBAnswered = false;
            bothTeamsAnswered = false;
            nextButton.style.display = "none";
            teamAScoreElement.textContent = "0";
            teamBScoreElement.textContent = "0";
            
            // Remove quiz setup if it exists
            if (quizSetupElement.parentNode) {
                quizSetupElement.parentNode.removeChild(quizSetupElement);
            }
            
            showQuestion();
        } catch (error) {
            // Error handling code remains the same
            console.error('Error starting quiz:', error);
            // Display error message to user
            questionElement.innerHTML = `
                <div class="text-center">
                    <h2 class="mb-8 text-2xl font-bold text-red-400">Error Loading Questions</h2>
                    <p class="mb-4">We couldn't load the quiz questions. Please try again later.</p>
                    <button id="retry-btn" class="px-4 py-2 bg-blue-500 rounded-lg hover:bg-blue-600">Retry</button>
                </div>
            `;
            
            // Add retry button functionality
            document.getElementById('retry-btn')?.addEventListener('click', startQuiz);
        }
    }

    function showQuestion() {
        resetState();
        
        // Check if questions array and current question exist
        if (!questions || !questions.length || currentQuestionIndex >= questions.length) {
            console.error('No questions available or invalid question index');
            return;
        }
        
        let currentQuestion = questions[currentQuestionIndex];
        
        // Verify that currentQuestion has the expected structure
        if (!currentQuestion || !currentQuestion.question || !Array.isArray(currentQuestion.answers)) {
            console.error('Invalid question format:', currentQuestion);
            return;
        }
        
        let questionNo = currentQuestionIndex + 1;

        if (teamAAnswered && teamBAnswered) {
          return;
        }

        // Add fade out animation before updating question
        questionElement.style.opacity = '0';
        setTimeout(() => {
          if (!teamAAnswered) {
            questionElement.innerHTML = `
              <div class="mb-8">
                <span class="text-lg text-white/60">Question ${questionNo}</span>
                <span class="ml-2 team-turn-badge-a">
                  <i class="mr-1 ri-team-fill"></i>Team A's turn
                </span>
              </div>
              <div class="text-xl md:text-2xl">${currentQuestion.question}</div>
            `;
            currentTeam = 'A';
            // Apply Team A's theme
            applyTheme(teamATheme);
          } else if (!teamBAnswered) {
            questionElement.innerHTML = `
              <div class="mb-8">
                <span class="text-lg text-white/60">Question ${questionNo}</span>
                <span class="ml-2 team-turn-badge-b">
                  <i class="mr-1 ri-team-fill"></i>Team B's turn
                </span>
              </div>
              <div class="text-xl md:text-2xl">${currentQuestion.question}</div>
            `;
            currentTeam = 'B';
            // Apply Team B's theme
            applyTheme(teamBTheme);
          }

          // Fade in animation
          setTimeout(() => {
            questionElement.style.opacity = '1';
          }, 100);
        }, 300);

        // Create answer buttons with enhanced styling
        currentQuestion.answers.forEach((answer, index) => {
          const button = document.createElement("button");
          button.innerHTML = `
            <div class="flex items-center">
              <span class="mr-3 text-white/60">${String.fromCharCode(65 + index)}.</span>
              <span class="flex-grow text-xl text-left text-blue-300">${answer.text}</span>
            </div>
          `;
          button.classList.add("btn");
          button.style.animation = `slideIn 0.3s ease-out ${index * 0.1}s both`;
          answerButtons.appendChild(button);

          if(answer.correct){
            button.dataset.correct = answer.correct;
          }

          if(teamAAnswered && answer.text === teamASelectedAnswer) {
            button.classList.add("team-a-selected");
          }

          // Store the answer text in the button's dataset
          button.dataset.answerText = answer.text;

          button.addEventListener("click", selectAnswer);
        });
    }

    function resetState() {
        nextButton.style.display = "none";
        while(answerButtons.firstChild) {
            answerButtons.removeChild(answerButtons.firstChild);
        }
    }

    function selectAnswer(e) {
        // Get the button element, whether clicked directly or through child elements
        const selectedBtn = e.target.closest('.btn');
        if (!selectedBtn) return; // Exit if no button found

        const isCorrect = selectedBtn.dataset.correct === 'true';
        const answerText = selectedBtn.dataset.answerText;

        // Prevent answering if the current team has already answered
        if ((currentTeam === 'A' && teamAAnswered) || (currentTeam === 'B' && teamBAnswered)) {
          return;
        }

        if(currentTeam === 'A') {
          teamAAnswered = true;
          teamACorrect = isCorrect;
          teamASelectedAnswer = answerText;
          selectedBtn.classList.add("team-a-selected");

          // Disable all buttons after Team A answers
          Array.from(answerButtons.children).forEach(button => {
            button.disabled = true;
          });

          // Show question for Team B
          setTimeout(() => {
            showQuestion();
          }, 500);
        } else { // Team B's turn
          teamBAnswered = true;
          teamBCorrect = isCorrect;
          selectedBtn.classList.add("team-b-selected");

          // Update scores
          if(teamACorrect) {
            teamAScore++;
            animateScore(teamAScoreElement, teamAScore);
          }
          if(teamBCorrect) {
            teamBScore++;
            animateScore(teamBScoreElement, teamBScore);
          }

          // Show results for both teams
          Array.from(answerButtons.children).forEach(button => {
            if(button.dataset.correct === "true"){
              button.classList.add("correct");
            }
            if(button === selectedBtn && !isCorrect) {
              button.classList.add("incorrect");
            }
            button.disabled = true;
          });

          // Move to next question
          setTimeout(() => {
            if(currentQuestionIndex < questions.length - 1) {
              handleNextButton();
            } else {
              showScore();
            }
          }, 2000);
        }

        bothTeamsAnswered = teamAAnswered && teamBAnswered;
    }

    function showScore() {
        resetState();
        const winner = teamAScore > teamBScore ? 'Team A' :
                      teamBScore > teamAScore ? 'Team B' :
                      'It\'s a tie';

        questionElement.innerHTML = `
          <div class="text-center">
            <h2 class="mb-8 text-4xl font-bold animate-bounce">Game Over!</h2>
            <div class="grid grid-cols-2 gap-8 mb-8">
              <div class="p-8 rounded-2xl border transition-transform transform bg-slate-700/30 border-white/10 hover:scale-105">
                <h3 class="mb-2 text-xl text-cyan-300">Team A</h3>
                <span class="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">${teamAScore}</span>
              </div>
              <div class="p-8 rounded-2xl border transition-transform transform bg-slate-700/30 border-white/10 hover:scale-105">
                <h3 class="mb-2 text-xl text-blue-300">Team B</h3>
                <span class="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">${teamBScore}</span>
              </div>
            </div>
            <div class="mb-8 text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
              ${winner === 'It\'s a tie' ? 'It\'s a tie!' : `${winner} wins!`}
            </div>
            <div class="text-lg text-white/60">
              ${getWinnerMessage(winner, teamAScore, teamBScore)}
            </div>
          </div>
        `;

        nextButton.innerHTML = '<i class="mr-2 ri-restart-line"></i>Play Again';
        nextButton.classList.remove('hidden');
        nextButton.classList.add('animate-pulse', 'glow');
    }

    function handleNextButton() {
        currentQuestionIndex++;
        teamAAnswered = false;
        teamBAnswered = false;
        bothTeamsAnswered = false;
        if(currentQuestionIndex < questions.length) {
            showQuestion();
        } else {
            showScore();
        }
    }

    function initializeTeamThemeSelectors() {
        const teamAButton = document.getElementById('team-a-theme-btn');
        const teamBButton = document.getElementById('team-b-theme-btn');
        const teamAMenu = document.getElementById('team-a-theme-menu');
        const teamBMenu = document.getElementById('team-b-theme-menu');
        const teamAThemeIndicator = document.querySelector('.team-a-theme-indicator');
        const teamBThemeIndicator = document.querySelector('.team-b-theme-indicator');

        // Set initial theme indicators
        teamAThemeIndicator.textContent = teamATheme;
        teamBThemeIndicator.textContent = teamBTheme;

        // Team A theme selection
        document.querySelectorAll('#team-a-theme-menu .theme-option').forEach(option => {
            option.addEventListener('click', function() {
                const theme = this.dataset.theme;
                teamATheme = theme;
                localStorage.setItem('teamATheme', theme);
                // Update theme indicator text
                teamAThemeIndicator.textContent = theme;
                if (currentTeam === 'A') {
                    applyTheme(theme);
                }
                teamAMenu.classList.add('hidden');
            });
        });

        // Team B theme selection
        document.querySelectorAll('#team-b-theme-menu .theme-option').forEach(option => {
            option.addEventListener('click', function() {
                const theme = this.dataset.theme;
                teamBTheme = theme;
                localStorage.setItem('teamBTheme', theme);
                // Update theme indicator text
                teamBThemeIndicator.textContent = theme;
                if (currentTeam === 'B') {
                    applyTheme(theme);
                }
                teamBMenu.classList.add('hidden');
            });
        });

        // Menu toggle handlers
        teamAButton?.addEventListener('click', () => {
            teamAMenu.classList.toggle('hidden');
            teamBMenu?.classList.add('hidden');
        });

        teamBButton?.addEventListener('click', () => {
            teamBMenu.classList.toggle('hidden');
            teamAMenu?.classList.add('hidden');
        });

        // Close menus when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#team-a-theme-btn') && !e.target.closest('#team-a-theme-menu')) {
                teamAMenu?.classList.add('hidden');
            }
            if (!e.target.closest('#team-b-theme-btn') && !e.target.closest('#team-b-theme-menu')) {
                teamBMenu?.classList.add('hidden');
            }
        });
    }

    // Add event listener for next button
    nextButton.addEventListener("click", () => {
        startQuiz();
    });

    // Initialize everything
    initializeTeamThemeSelectors();
    applyTheme(currentTeam === 'A' ? teamATheme : teamBTheme);
    
    // Load question bank and show setup instead of directly starting the quiz
    loadQuestionBank().then(success => {
        if (success) {
            showQuizSetup();
        } else {
            // Show error if question bank couldn't be loaded
            questionElement.innerHTML = `
                <div class="text-center">
                    <h2 class="mb-8 text-2xl font-bold text-red-400">Error Loading Questions</h2>
                    <p class="mb-4">We couldn't load the quiz questions. Please try again later.</p>
                    <button id="retry-btn" class="px-4 py-2 bg-blue-500 rounded-lg hover:bg-blue-600">Retry</button>
                </div>
            `;
            
            document.getElementById('retry-btn')?.addEventListener('click', () => {
                loadQuestionBank().then(success => {
                    if (success) showQuizSetup();
                });
            });
        }
    });
    
    // Update next button to show quiz setup instead of directly restarting
    nextButton.addEventListener("click", () => {
        showQuizSetup();
    });
});

// Make applyTheme available globally if needed
window.applyTheme = applyTheme;

// Add these CSS styles to your style.css file
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    .score-animation {
        transform: scale(1.3);
        transition: all 0.3s ease-in-out;
    }

    @keyframes scoreHighlight {
        0% { transform: scale(1); }
        50% { transform: scale(1.3); }
        100% { transform: scale(1); }
    }

    .score-highlight {
        animation: scoreHighlight 0.5s ease-in-out;
    }
`;
document.head.appendChild(styleSheet);

function getWinnerMessage(winner, teamAScore, teamBScore) {
    const scoreDifference = Math.abs(teamAScore - teamBScore);

    if (winner === 'It\'s a tie') {
        return "Both teams performed equally well! Great game!";
    }

    if (scoreDifference >= 4) {
        return `${winner} dominated the game with an impressive victory!`;
    } else if (scoreDifference >= 2) {
        return `${winner} secured a solid win!`;
    } else {
        return `${winner} won in a close match!`;
    }
}
