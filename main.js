// Ініціалізація Telegram Web App
let tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// Анімація завантаження
document.addEventListener('DOMContentLoaded', () => {
    // Приховуємо loader після завантаження
    setTimeout(() => {
        const loader = document.querySelector('.cube-loader');
        if (loader) {
            loader.style.display = 'none';
        }
    }, 2000); // 2 секунди на анімацію
});

// Анімація кнопок
document.querySelectorAll('.btn').forEach(button => {
    button.addEventListener('mouseover', function() {
        this.style.transform = 'scale(1.05)';
        this.style.transition = 'transform 0.3s ease';
    });

    button.addEventListener('mouseout', function() {
        this.style.transform = 'scale(1)';
    });

    button.addEventListener('click', function() {
        this.style.transform = 'scale(0.95)';
        setTimeout(() => {
            this.style.transform = 'scale(1)';
        }, 100);
    });
});

// Перевірка авторизації
function checkAuth() {
    const token = localStorage.getItem('userToken');
    if (token) {
        // Якщо користувач авторизований, перенаправляємо на профіль
        window.location.href = 'profile.html';
    }
}

// Перевірка при завантаженні сторінки
checkAuth();

// Обробка кліку по кубику (Easter egg)
document.querySelector('.cube-loader')?.addEventListener('click', () => {
    const audio = new Audio('path_to_your_sound.mp3'); // Можна додати звуковий ефект
    audio.play();
    
    // Додаємо анімацію обертання
    const cube = document.querySelector('.cube-wrapper');
    cube.style.animation = 'spin 1s linear';
    
    setTimeout(() => {
        cube.style.animation = '';
    }, 1000);
});

// Додаємо адаптивне меню для мобільних пристроїв
const mediaQuery = window.matchMedia('(max-width: 768px)');

function handleMobileLayout(e) {
    const buttons = document.querySelector('.buttons');
    if (e.matches) {
        // Мобільний layout
        buttons.style.flexDirection = 'column';
    } else {
        // Десктопний layout
        buttons.style.flexDirection = 'row';
    }
}

// Перевіряємо при завантаженні
mediaQuery.addListener(handleMobileLayout);
handleMobileLayout(mediaQuery);

// Додаємо анімацію для заголовка
const header = document.querySelector('.header h1');
if (header) {
    let text = header.textContent;
    header.textContent = '';
    
    // Анімація появи тексту по буквах
    for (let i = 0; i < text.length; i++) {
        setTimeout(() => {
            header.textContent += text[i];
        }, 100 * i);
    }
}

// Функція для плавного скролу
function smoothScroll(target) {
    const element = document.querySelector(target);
    if (element) {
        window.scrollTo({
            top: element.offsetTop,
            behavior: 'smooth'
        });
    }
}

// Додаємо обробку помилок
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('Помилка: ', msg, '\nURL: ', url, '\nРядок: ', lineNo, '\nКолонка: ', columnNo, '\nПомилка: ', error);
    return false;
};

// Додаємо анімацію для footer
const footer = document.querySelector('.footer');
if (footer) {
    window.addEventListener('scroll', () => {
        const position = footer.getBoundingClientRect();
        if (position.top < window.innerHeight) {
            footer.style.opacity = '1';
            footer.style.transform = 'translateY(0)';
        }
    });
}
