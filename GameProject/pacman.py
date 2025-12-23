import pygame
import sys
import random

# Initialize Pygame
pygame.init()

# Screen settings
screen_width, screen_height = 800, 600
screen = pygame.display.set_mode((screen_width, screen_height), pygame.RESIZABLE)
pygame.display.set_caption('Pac-Man Clone')

# Colors
BLACK = (0, 0, 0)
YELLOW = (255, 255, 0)
WHITE = (255, 255, 255)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
BLUE = (0, 0, 255)

# Pac-Man settings
pacman_size = 20
pacman_x, pacman_y = screen_width // 2, screen_height // 2
pacman_speed = 5
pacman_direction = 'RIGHT'
power_mode = False
power_timer = 0

# Ghost settings
ghost_size = 20
num_ghosts = 4
ghosts = [
    [random.randint(120, 680), random.randint(120, 480), random.choice([-3, 3]), random.choice([-3, 3])]
    for _ in range(num_ghosts)
]

# Walls (x, y, width, height)
walls = [
    (100, 100, 600, 20),
    (100, 500, 600, 20),
    (100, 100, 20, 400),
    (700, 100, 20, 420)
]

# Points (randomly placed)
num_points = 10
points = [
    [random.randint(120, 680), random.randint(120, 480)]
    for _ in range(num_points)
]

# Power-ups (randomly placed)
num_power_ups = 3
power_ups = [
    [random.randint(120, 680), random.randint(120, 480)]
    for _ in range(num_power_ups)
]

# Score, High Score, and Level
score = 0
high_score = 0
level = 1
font = pygame.font.SysFont(None, 48)

# Sounds
pygame.mixer.init()
try:
    pygame.mixer.music.load('background_music.mp3')
    eat_sound = pygame.mixer.Sound('eat.mp3')
    gameover_sound = pygame.mixer.Sound('gameover.mp3')
except pygame.error as e:
    print(f"Sound file error: {e}")

# Game state
game_active = False
win_message_timer = 0

# Countdown for next level
def countdown():
    for i in range(5, 0, -1):
        screen.fill(BLACK)
        text = font.render(f'Next Level in {i}', True, WHITE)
        screen.blit(text, (screen_width // 2 - 100, screen_height // 2))
        pygame.display.flip()
        pygame.time.delay(1000)

# Main game loop
clock = pygame.time.Clock()
while True:
    screen.fill(BLACK)

    if not game_active:
        start_text = font.render('Press any key to start the game', True, WHITE)
        screen.blit(start_text, (screen_width // 2 - 200, screen_height // 2))
        pygame.display.flip()
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
            if event.type == pygame.KEYDOWN:
                game_active = True
                try:
                    pygame.mixer.music.play(-1)
                except pygame.error:
                    pass
        continue

    # Event handling
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            pygame.quit()
            sys.exit()
    
    # Keypresses
    keys = pygame.key.get_pressed()
    if keys[pygame.K_LEFT]:
        pacman_x -= pacman_speed
        pacman_direction = 'LEFT'
    if keys[pygame.K_RIGHT]:
        pacman_x += pacman_speed
        pacman_direction = 'RIGHT'
    if keys[pygame.K_UP]:
        pacman_y -= pacman_speed
        pacman_direction = 'UP'
    if keys[pygame.K_DOWN]:
        pacman_y += pacman_speed
        pacman_direction = 'DOWN'

    # Boundary checks
    pacman_x = max(100, min(700 - pacman_size, pacman_x))
    pacman_y = max(100, min(500 - pacman_size, pacman_y))

    # Collision with points
    for point in points[:]:
        if abs(pacman_x - point[0]) < pacman_size and abs(pacman_y - point[1]) < pacman_size:
            points.remove(point)
            score += 10
            try:
                pygame.mixer.music.stop()
                eat_sound.play()
                pygame.mixer.music.play(-1)
            except pygame.error:
                pass

    # Draw Pac-Man with mouth direction
    pygame.draw.circle(screen, YELLOW, (pacman_x, pacman_y), pacman_size)
    if pacman_direction == 'RIGHT':
        pygame.draw.polygon(screen, BLACK, [(pacman_x, pacman_y), (pacman_x + pacman_size, pacman_y - 5), (pacman_x + pacman_size, pacman_y + 5)])
    elif pacman_direction == 'LEFT':
        pygame.draw.polygon(screen, BLACK, [(pacman_x, pacman_y), (pacman_x - pacman_size, pacman_y - 5), (pacman_x - pacman_size, pacman_y + 5)])
    elif pacman_direction == 'UP':
        pygame.draw.polygon(screen, BLACK, [(pacman_x, pacman_y), (pacman_x - 5, pacman_y - pacman_size), (pacman_x + 5, pacman_y - pacman_size)])
    elif pacman_direction == 'DOWN':
        pygame.draw.polygon(screen, BLACK, [(pacman_x, pacman_y), (pacman_x - 5, pacman_y + pacman_size), (pacman_x + 5, pacman_y + pacman_size)])

    # Draw ghosts
    for ghost in ghosts:
        pygame.draw.circle(screen, RED, (ghost[0], ghost[1]), ghost_size)
        ghost[0] += ghost[2]
        ghost[1] += ghost[3]
        if ghost[0] <= 100 or ghost[0] >= 700:
            ghost[2] = -ghost[2]
        if ghost[1] <= 100 or ghost[1] >= 500:
            ghost[3] = -ghost[3]

    # Draw points and power-ups
    for point in points:
        pygame.draw.circle(screen, WHITE, (point[0], point[1]), 5)
    for power_up in power_ups:
        pygame.draw.circle(screen, BLUE, (power_up[0], power_up[1]), 8)

    # Display score, high score, and level
    score_text = font.render(f'Score: {score}  High Score: {high_score}  Level: {level}', True, WHITE)
    screen.blit(score_text, (10, 10))

    # Update display
    pygame.display.flip()
    clock.tick(30)
