"""
Tests for ResUNet model architecture and functionality.
"""
import pytest
import torch
import numpy as np
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from ResUnet import ResUNet, ResidualBlock


class TestResidualBlock:
    """Test the ResidualBlock component."""
    
    def test_residual_block_forward(self):
        """Test forward pass through residual block."""
        block = ResidualBlock(64, 128)
        x = torch.randn(2, 64, 32, 32)  # batch_size=2, channels=64, height=32, width=32
        
        output = block(x)
        
        assert output.shape == (2, 128, 32, 32)
        assert not torch.isnan(output).any()
    
    def test_residual_block_same_channels(self):
        """Test residual block when input and output channels are the same."""
        block = ResidualBlock(64, 64)
        x = torch.randn(1, 64, 16, 16)
        
        output = block(x)
        
        assert output.shape == (1, 64, 16, 16)
        assert not torch.isnan(output).any()


class TestResUNet:
    """Test the ResUNet model."""
    
    @pytest.fixture
    def model(self):
        """Create a ResUNet model instance."""
        return ResUNet(in_channels=3, out_channels=1)
    
    def test_model_architecture(self, model):
        """Test that model has expected architecture."""
        # Check encoder blocks
        assert hasattr(model, 'downs')
        assert isinstance(model.downs, torch.nn.ModuleList)
        assert len(model.downs) == 5  # 5 down blocks for default features
        
        # Check bottleneck
        assert hasattr(model, 'bottleneck')
        
        # Check decoder blocks
        assert hasattr(model, 'ups')
        assert isinstance(model.ups, torch.nn.ModuleList)
        assert len(model.ups) == 10  # 5 * 2 (transposed conv + residual block)
        
        # Check attention gates
        assert hasattr(model, 'attentions')
        assert isinstance(model.attentions, torch.nn.ModuleList)
        assert len(model.attentions) == 5
        
        # Check final conv
        assert hasattr(model, 'final_conv')
    
    def test_forward_pass(self, model):
        """Test forward pass with different input sizes."""
        # Test with 256x256 input
        x = torch.randn(1, 3, 256, 256)
        output = model(x)
        
        assert output.shape == (1, 1, 256, 256)
        assert not torch.isnan(output).any()
        
        # Test with 512x512 input
        x_large = torch.randn(1, 3, 512, 512)
        output_large = model(x_large)
        
        assert output_large.shape == (1, 1, 512, 512)
        assert not torch.isnan(output_large).any()
    
    def test_model_gradient_flow(self, model):
        """Test that gradients flow through the model."""
        x = torch.randn(1, 3, 128, 128, requires_grad=True)
        target = torch.randn(1, 1, 128, 128)
        
        output = model(x)
        loss = torch.nn.functional.mse_loss(output, target)
        loss.backward()
        
        # Check that input has gradients
        assert x.grad is not None
        assert not torch.isnan(x.grad).any()
        
        # Check that model parameters have gradients
        for param in model.parameters():
            if param.requires_grad:
                assert param.grad is not None
                assert not torch.isnan(param.grad).any()
    
    def test_model_inference_mode(self, model):
        """Test model in inference mode."""
        model.eval()
        
        with torch.no_grad():
            x = torch.randn(2, 3, 256, 256)
            output = model(x)
            
            assert output.shape == (2, 1, 256, 256)
            assert not torch.isnan(output).any()
    
    @pytest.mark.parametrize("batch_size", [1, 2, 4, 8])
    def test_different_batch_sizes(self, model, batch_size):
        """Test model with different batch sizes."""
        x = torch.randn(batch_size, 3, 128, 128)
        output = model(x)
        
        assert output.shape == (batch_size, 1, 128, 128)
        assert not torch.isnan(output).any()
    
    def test_model_device_compatibility(self, model):
        """Test model on CPU (and GPU if available)."""
        # Test on CPU
        model_cpu = model.cpu()
        x_cpu = torch.randn(1, 3, 64, 64)
        output_cpu = model_cpu(x_cpu)
        
        assert output_cpu.device.type == 'cpu'
        assert output_cpu.shape == (1, 1, 64, 64)
        
        # Test on GPU if available
        if torch.cuda.is_available():
            model_gpu = model.cuda()
            x_gpu = torch.randn(1, 3, 64, 64).cuda()
            output_gpu = model_gpu(x_gpu)
            
            assert output_gpu.device.type == 'cuda'
            assert output_gpu.shape == (1, 1, 64, 64)
    
    def test_model_parameter_count(self, model):
        """Test that model has reasonable number of parameters."""
        total_params = sum(p.numel() for p in model.parameters())
        trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
        
        # ResUNet should have millions of parameters
        assert total_params > 1_000_000
        assert trainable_params == total_params  # All params should be trainable by default
        
        print(f"Total parameters: {total_params:,}")
        print(f"Trainable parameters: {trainable_params:,}")


class TestModelSaveLoad:
    """Test model checkpoint save/load functionality."""
    
    def test_save_load_state_dict(self, tmp_path):
        """Test saving and loading model state dict."""
        # Create and save model
        model1 = ResUNet(in_channels=3, out_channels=1)
        save_path = tmp_path / "model.pth"
        torch.save(model1.state_dict(), save_path)
        
        # Load into new model
        model2 = ResUNet(in_channels=3, out_channels=1)
        model2.load_state_dict(torch.load(save_path))
        
        # Compare outputs
        model1.eval()
        model2.eval()
        
        with torch.no_grad():
            x = torch.randn(1, 3, 128, 128)
            output1 = model1(x)
            output2 = model2(x)
            
            assert torch.allclose(output1, output2, atol=1e-6)
    
    def test_checkpoint_format(self, tmp_path):
        """Test saving/loading in checkpoint format."""
        model = ResUNet(in_channels=3, out_channels=1)
        optimizer = torch.optim.Adam(model.parameters())
        
        # Create checkpoint
        checkpoint = {
            'epoch': 10,
            'state_dict': model.state_dict(),
            'optimizer': optimizer.state_dict(),
            'loss': 0.123
        }
        
        save_path = tmp_path / "checkpoint.pth.tar"
        torch.save(checkpoint, save_path)
        
        # Load checkpoint
        loaded = torch.load(save_path)
        assert loaded['epoch'] == 10
        assert loaded['loss'] == 0.123
        assert 'state_dict' in loaded
        assert 'optimizer' in loaded