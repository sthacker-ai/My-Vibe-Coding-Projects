import pygame
import random
import sys

# Initialize pygame
pygame.init()

# Constants
SCREEN_WIDTH = 800
SCREEN_HEIGHT = 600
CELL_SIZE = 40
GRID_WIDTH = SCREEN_WIDTH // CELL_SIZE
GRID_HEIGHT = SCREEN_HEIGHT // CELL_SIZE
FPS = 60

# Colors
BLACK = (0, 0, 0)
BLUE = (0, 0, 255)
WHITE = (255, 255, 255)
YELLOW = (255, 255, 0)
RED = (255, 0, 0)
PINK = (255, 192, 203)
CYAN = (0, 255, 255)
ORANGE = (255, 165, 0)

# Create the screen
screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption("Basic Pac-Man")
clock = pygame.time.Clock()

# Game map - 0 is empty space, 1 is wall, 2 is pellet
game_map = []
for y in range(GRID_HEIGHT):
    row = []
    for x in range(GRID_WIDTH):
        # Create a border around the map
        if x == 0 or x == GRID_WIDTH - 1 or y == 0 or y == GRID_HEIGHT - 1:
            row.append(1)  # Wall
        else:
            # Randomly place some walls, but make sure there's enough space to move
            if random.random() < 0.15 and not (x == 1 and y == 1):
                row.append(1)  # Wall
            else:
                row.append(2)  # Pellet
    game_map.append(row)

# Pacman position, starting at top-left empty cell
pacman_x, pacman_y = 1, 1
game_map[pacman_y][pacman_x] = 0  # Remove pellet from Pacman's starting position

# Direction constants
UP = (0, -1)
DOWN = (0, 1)
LEFT = (-1, 0)
RIGHT = (1, 0)

# Pacman's current direction
pacman_direction = RIGHT

# Ghost class
class Ghost:
    def __init__(self, x, y, color):
        self.x = x
        self.y = y
        self.color = color
        self.direction = random.choice([UP, DOWN, LEFT, RIGHT])
        
    def move(self, game_map):
        # Attempt to move in the current direction
        new_x = self.x + self.direction[0]
        new_y = self.y + self.direction[1]
        
        # Check if the new position is valid (not a wall)
        if 0 <= new_x < GRID_WIDTH and 0 <= new_y < GRID_HEIGHT and game_map[new_y][new_x] != 1:
            self.x, self.y = new_x, new_y
        else:
            # Choose a new random direction if blocked
            valid_directions = []
            for dir in [UP, DOWN, LEFT, RIGHT]:
                check_x = self.x + dir[0]
                check_y = self.y + dir[1]
                if 0 <= check_x < GRID_WIDTH and 0 <= check_y < GRID_HEIGHT and game_map[check_y][check_x] != 1:
                    valid_directions.append(dir)
            
            if valid_directions:
                self.direction = random.choice(valid_directions)
                self.x += self.direction[0]
                self.y += self.direction[1]

# Create ghosts at different positions
ghosts = [
    Ghost(GRID_WIDTH - 2, 1, RED),
    Ghost(1, GRID_HEIGHT - 2, PINK),
    Ghost(GRID_WIDTH - 2, GRID_HEIGHT - 2, CYAN)
]

# Initialize score
score = 0
font = pygame.font.SysFont(None, 36)

# Initialize movement delay for smoother control
movement_delay = 0
DELAY_AMOUNT = 10  # Adjust for desired speed

# Game loop
running = True
game_over = False
while running:
    # Event handling
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        elif event.type == pygame.KEYDOWN and not game_over:
            if event.key == pygame.K_UP:
                pacman_direction = UP
            elif event.key == pygame.K_DOWN:
                pacman_direction = DOWN
            elif event.key == pygame.K_LEFT:
                pacman_direction = LEFT
            elif event.key == pygame.K_RIGHT:
                pacman_direction = RIGHT
            elif event.key == pygame.K_r and game_over:
                # Reset game (simplified - would need proper reset logic)
                game_over = False
                
    if not game_over:
        # Movement delay to control speed
        movement_delay += 1
        if movement_delay >= DELAY_AMOUNT:
            movement_delay = 0
            
            # Move Pacman
            new_x = pacman_x + pacman_direction[0]
            new_y = pacman_y + pacman_direction[1]
            
            # Check if the new position is valid (not a wall)
            if 0 <= new_x < GRID_WIDTH and 0 <= new_y < GRID_HEIGHT and game_map[new_y][new_x] != 1:
                pacman_x, pacman_y = new_x, new_y
                
                # Check if Pacman ate a pellet
                if game_map[pacman_y][pacman_x] == 2:
                    game_map[pacman_y][pacman_x] = 0  # Remove pellet
                    score += 10
                    
                    # Check if all pellets are eaten
                    all_eaten = True
                    for row in game_map:
                        if 2 in row:
                            all_eaten = False
                            break
                    
                    if all_eaten:
                        game_over = True
                        win = True
            
            # Move ghosts
            for ghost in ghosts:
                ghost.move(game_map)
                
                # Check collision with Pacman
                if ghost.x == pacman_x and ghost.y == pacman_y:
                    game_over = True
                    win = False
    
    # Draw everything
    screen.fill(BLACK)
    
    # Draw the map
    for y in range(GRID_HEIGHT):
        for x in range(GRID_WIDTH):
            cell_rect = pygame.Rect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
            
            if game_map[y][x] == 1:  # Wall
                pygame.draw.rect(screen, BLUE, cell_rect)
            elif game_map[y][x] == 2:  # Pellet
                pygame.draw.circle(screen, WHITE, 
                                 (x * CELL_SIZE + CELL_SIZE // 2, 
                                  y * CELL_SIZE + CELL_SIZE // 2), 
                                 CELL_SIZE // 8)
    
    # Draw Pacman
    pygame.draw.circle(screen, YELLOW, 
                     (pacman_x * CELL_SIZE + CELL_SIZE // 2, 
                      pacman_y * CELL_SIZE + CELL_SIZE // 2), 
                     CELL_SIZE // 2 - 2)
    
    # Draw ghosts
    for ghost in ghosts:
        pygame.draw.circle(screen, ghost.color, 
                         (ghost.x * CELL_SIZE + CELL_SIZE // 2, 
                          ghost.y * CELL_SIZE + CELL_SIZE // 2), 
                         CELL_SIZE // 2 - 2)
    
    # Draw score
    score_text = font.render(f"Score: {score}", True, WHITE)
    screen.blit(score_text, (10, 10))
    
    # Draw game over message
    if game_over:
        if win:
            message = "You Won! Press R to restart"
        else:
            message = "Game Over! Press R to restart"
            
        game_over_text = font.render(message, True, WHITE)
        text_rect = game_over_text.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2))
        screen.blit(game_over_text, text_rect)
    
    # Update the display
    pygame.display.flip()
    
    # Cap the frame rate
    clock.tick(FPS)

# Quit pygame
pygame.quit()
sys.exit()