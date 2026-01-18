import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Request,
  Param,
  NotFoundException,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { UpdateProfileDto } from "../auth/dto/update-profile.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ServiceJwtGuard } from "../auth/guards/service-jwt.guard";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("profile")
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req: any) {
    const user = await this.usersService.findById(req.user.userId);
    if (!user) {
      throw new Error("User not found");
    }
    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  @Put("profile")
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Request() req: any,
    @Body() updateProfileDto: UpdateProfileDto
  ) {
    const user = await this.usersService.updateProfile(
      req.user.userId,
      updateProfileDto
    );
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Service-to-service endpoint to get user by ID
   * Protected by ServiceJwtGuard - only services can access this
   */
  @Get(":id")
  @UseGuards(ServiceJwtGuard)
  async getUserById(@Param("id") id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    // Remove password from response
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
